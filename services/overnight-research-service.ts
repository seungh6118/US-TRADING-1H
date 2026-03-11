import { saveOvernightSnapshot, snapshotExists } from "@/db/overnight-snapshot-repository";
import { defaultOvernightSettings, normalizeOvernightSettings } from "@/lib/overnight-defaults";
import { inferSectorEtf, marketIndexSymbols, overnightFocusSymbols, overnightScreeners } from "@/lib/overnight-universe";
import { overnightRuntime } from "@/lib/overnight-runtime";
import {
  CatalystTag,
  OvernightAlert,
  OvernightCandidate,
  OvernightDashboardData,
  OvernightDataStatus,
  OvernightMarketBrief,
  OvernightNewsItem,
  OvernightRawCandidate,
  OvernightSettings,
  PostMarketSuitability,
  StoredOvernightSnapshot
} from "@/lib/overnight-types";
import { average, clamp, daysUntil, round1, sum, toIsoDateInTimezone } from "@/lib/utils";
import { mockOvernightMarketBrief, mockOvernightUniverse } from "@/providers/mock/overnight-mock";
import {
  fetchYahooChartData,
  fetchYahooFocusSymbolQuote,
  fetchYahooScreenerQuotes,
  fetchYahooSearchBundle,
  YahooChartData,
  YahooScreenedQuote
} from "@/providers/live/yahoo-overnight";
import { scoreOvernightCandidate } from "@/scoring/overnight-engine";
import { buildStoredSnapshotBacktest, buildTradeSeriesLookback } from "@/services/overnight-backtest-service";

type CachedDashboard = {
  expiresAt: number;
  data: OvernightDashboardData;
};

const dashboardCache = new Map<string, CachedDashboard>();

const POSITIVE_KEYWORDS = [
  "beat",
  "beats",
  "tops",
  "raises",
  "raised",
  "boosts",
  "wins",
  "contract",
  "order",
  "partnership",
  "deal",
  "upgrade",
  "outperform",
  "buy rating",
  "target raised",
  "approval",
  "ai",
  "data center",
  "datacenter",
  "power demand"
];

const NEGATIVE_KEYWORDS = [
  "miss",
  "misses",
  "cuts",
  "cut",
  "downgrade",
  "downgraded",
  "dilution",
  "offering",
  "lawsuit",
  "investigation",
  "probe",
  "warning",
  "delay",
  "weak",
  "slump",
  "target cut",
  "share sale"
];

const CATALYST_KEYWORDS: Record<CatalystTag, string[]> = {
  earnings: ["earnings", "results", "revenue", "eps", "quarter"],
  guidance: ["guidance", "outlook", "forecast", "raises", "sees", "boosts"],
  contract: ["contract", "deal", "order", "partnership", "agreement", "award"],
  policy: ["tariff", "policy", "grant", "subsidy", "loan", "approval", "fda", "waiver", "regulation"],
  analyst: ["analyst", "upgrade", "outperform", "overweight", "price target", "buy rating"],
  theme: ["ai", "data center", "datacenter", "semiconductor", "chip", "power", "cloud", "cyber"],
  dilution: ["dilution", "offering", "secondary", "convertible", "share sale"],
  litigation: ["lawsuit", "investigation", "probe", "class action", "sec"],
  downgrade: ["downgrade", "underperform", "sell rating", "target cut"]
};

function getCacheKey(settings: OvernightSettings): string {
  return JSON.stringify(settings);
}

function passesFilters(candidate: OvernightCandidate, settings: OvernightSettings) {
  const hasUpcomingEarningsRisk = candidate.daysToEarnings >= 0 && candidate.daysToEarnings <= 3;
  if (candidate.price < settings.minPrice) {
    return false;
  }
  if (candidate.averageVolume < settings.minAverageVolume) {
    return false;
  }
  if (candidate.averageDollarVolumeM < settings.minAverageDollarVolumeM) {
    return false;
  }
  if (candidate.marketCapBn < settings.minMarketCapBn) {
    return false;
  }
  if (candidate.score.grade === "Excluded") {
    return false;
  }
  if (settings.excludeUpcomingEarnings && hasUpcomingEarningsRisk) {
    return false;
  }
  if (!settings.allowPostMarket && candidate.postMarketSuitability === "avoid") {
    return false;
  }
  if (settings.onlyAGrade && candidate.score.grade !== "A") {
    return false;
  }
  return true;
}

function getTitleTone(title: string) {
  const lower = title.toLowerCase();
  const positiveHits = POSITIVE_KEYWORDS.filter((keyword) => lower.includes(keyword)).length;
  const negativeHits = NEGATIVE_KEYWORDS.filter((keyword) => lower.includes(keyword)).length;
  if (negativeHits > positiveHits) {
    return "negative" as const;
  }
  if (positiveHits > 0) {
    return "positive" as const;
  }
  return "neutral" as const;
}

function getTitleCatalyst(title: string): CatalystTag {
  const lower = title.toLowerCase();
  let bestTag: CatalystTag = "theme";
  let bestScore = -1;

  (Object.entries(CATALYST_KEYWORDS) as Array<[CatalystTag, string[]]>).forEach(([tag, keywords]) => {
    const hits = keywords.filter((keyword) => lower.includes(keyword)).length;
    if (hits > bestScore) {
      bestScore = hits;
      bestTag = tag;
    }
  });

  return bestTag;
}

function buildNewsItems(symbol: string, items: Awaited<ReturnType<typeof fetchYahooSearchBundle>>["news"]): OvernightNewsItem[] {
  return items.slice(0, 4).map((item) => {
    const sentiment = getTitleTone(item.title);
    const catalyst = getTitleCatalyst(item.title);
    const catalystLabel =
      catalyst === "earnings"
        ? "실적"
        : catalyst === "guidance"
          ? "가이던스"
          : catalyst === "contract"
            ? "수주/계약"
            : catalyst === "policy"
              ? "정책"
              : catalyst === "analyst"
                ? "애널리스트"
                : catalyst === "dilution"
                  ? "희석"
                  : catalyst === "litigation"
                    ? "소송/규제"
                    : catalyst === "downgrade"
                      ? "하향"
                      : "테마";

    return {
      id: item.id,
      title: item.title,
      source: item.source,
      publishedAt: item.publishedAt,
      sentiment,
      catalyst,
      summary: `${catalystLabel} 재료로 분류된 기사입니다. ${sentiment === "positive" ? "익일 관심을 끌 수 있는" : sentiment === "negative" ? "리스크를 키울 수 있는" : "방향성이 아직 중립적인"} 헤드라인으로 해석됩니다.`,
      url: item.url,
      relatedTickers: item.relatedTickers.length > 0 ? item.relatedTickers : [symbol]
    };
  });
}

function parseAnalystRating(value: string | null): number {
  if (!value) {
    return 55;
  }

  const match = value.match(/(\d+(?:\.\d+)?)/);
  const numeric = match ? Number(match[1]) : 2.5;
  if (!Number.isFinite(numeric)) {
    return 55;
  }

  return round1(clamp(100 - (numeric - 1) * 25, 10, 95));
}

function buildNewsScores(news: OvernightNewsItem[], analystRating: string | null, screeners: string[]) {
  const positive = news.filter((item) => item.sentiment === "positive");
  const negative = news.filter((item) => item.sentiment === "negative");
  const screenerBonus =
    (screeners.includes("day_gainers") ? 16 : 0) +
    (screeners.includes("growth_technology_stocks") ? 12 : 0) +
    (screeners.includes("most_actives") ? 10 : 0);

  const earningsScore = clamp(
    positive.filter((item) => item.catalyst === "earnings").length * 36 +
      positive.filter((item) => item.title.toLowerCase().includes("beat")).length * 14,
    0,
    100
  );

  const guidanceScore = clamp(positive.filter((item) => item.catalyst === "guidance").length * 38, 0, 100);
  const contractScore = clamp(positive.filter((item) => item.catalyst === "contract").length * 34, 0, 100);
  const policyScore = clamp(positive.filter((item) => item.catalyst === "policy").length * 34, 0, 100);
  const analystScore = clamp(
    parseAnalystRating(analystRating) +
      positive.filter((item) => item.catalyst === "analyst").length * 16 +
      (screeners.includes("most_actives") ? 8 : 0) +
      (screeners.includes("growth_technology_stocks") ? 6 : 0),
    0,
    100
  );
  const themeScore = clamp(
    40 +
      positive.filter((item) => item.catalyst === "theme").length * 24 +
      screenerBonus,
    0,
    100
  );
  const negativeHeadlinePenalty = clamp(negative.length * 16 + news.filter((item) => item.catalyst === "downgrade").length * 8, 0, 100);
  const dilutionPenalty = clamp(news.filter((item) => item.catalyst === "dilution").length * 35, 0, 100);
  const litigationPenalty = clamp(news.filter((item) => item.catalyst === "litigation").length * 35, 0, 100);

  return {
    earningsScore,
    guidanceScore,
    contractScore,
    policyScore,
    analystScore,
    themeScore,
    negativeHeadlinePenalty,
    dilutionPenalty,
    litigationPenalty
  };
}

function filterRegularBars(chart: YahooChartData) {
  return chart.regularStart && chart.regularEnd
    ? chart.bars.filter((bar) => bar.time >= chart.regularStart! && bar.time <= chart.regularEnd!)
    : chart.bars;
}

function filterPostBars(chart: YahooChartData) {
  return chart.postStart && chart.postEnd
    ? chart.bars.filter((bar) => bar.time >= chart.postStart! && bar.time <= chart.postEnd!)
    : [];
}

function computeVwap(bars: Array<{ high: number; low: number; close: number; volume: number }>) {
  const weighted = bars.map((bar) => ((bar.high + bar.low + bar.close) / 3) * bar.volume);
  const volumes = bars.map((bar) => bar.volume);
  return sum(volumes) > 0 ? sum(weighted) / sum(volumes) : bars.at(-1)?.close ?? 0;
}

function computeSpreadBps(quote: YahooScreenedQuote, price: number, averageDollarVolumeM: number) {
  if (quote.bid && quote.ask && quote.ask > quote.bid && price > 0) {
    return ((quote.ask - quote.bid) / ((quote.ask + quote.bid) / 2)) * 10_000;
  }

  if (averageDollarVolumeM >= 1_000) {
    return 8;
  }
  if (averageDollarVolumeM >= 250) {
    return 18;
  }
  if (averageDollarVolumeM >= 80) {
    return 28;
  }
  return 45;
}

function computeAfterHoursSpreadStable(spreadBps: number, afterHoursVolumeRatio: number, marketCapBn: number) {
  return clamp(95 - spreadBps * 0.9 + afterHoursVolumeRatio * 30 + Math.min(marketCapBn / 25, 10), 20, 96);
}

function determinePostMarketSuitability(
  spreadBps: number,
  averageDollarVolumeM: number,
  negativeHeadlinePenalty: number,
  afterHoursVolumeRatio: number
): PostMarketSuitability {
  if (spreadBps <= 25 && averageDollarVolumeM >= 80 && negativeHeadlinePenalty <= 18 && afterHoursVolumeRatio >= 0.02) {
    return "ideal";
  }
  if (spreadBps <= 60 && averageDollarVolumeM >= 25 && negativeHeadlinePenalty <= 35) {
    return "allowed";
  }
  return "avoid";
}

function buildSnapshotId(sessionDate: string, recordedAt: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: overnightRuntime.marketTimezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const [hourText, minuteText] = formatter.format(new Date(recordedAt)).split(":");
  const minuteBucket = Math.floor(Number(minuteText) / 15) * 15;
  return `${sessionDate}-${hourText}${String(minuteBucket).padStart(2, "0")}`;
}

function getCloseCountdownMinutes(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: overnightRuntime.marketTimezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const [hourText, minuteText] = formatter.format(now).split(":");
  const minutes = Number(hourText) * 60 + Number(minuteText);
  const open = 9 * 60 + 30;
  const close = 16 * 60;

  if (minutes < open) {
    return close - open;
  }
  if (minutes >= close) {
    return 0;
  }
  return close - minutes;
}

function rankScreenerQuote(quote: YahooScreenedQuote) {
  const screenerBonus =
    (quote.screeners.includes("day_gainers") ? 40 : 0) +
    (quote.screeners.includes("most_actives") ? 30 : 0) +
    (quote.screeners.includes("growth_technology_stocks") ? 18 : 0);

  return screenerBonus + quote.dayChangePct * 4 + Math.log10(Math.max(quote.volume, 1));
}

async function buildSectorMomentumGetter() {
  const cache = new Map<string, Promise<number>>();

  return async (sector: string, industry: string) => {
    const etf = inferSectorEtf(sector, industry);
    if (!cache.has(etf)) {
      cache.set(
        etf,
        fetchYahooChartData(etf, "3mo", "1d", false).then((chart) => {
          const closes = chart.bars.map((bar) => bar.close);
          if (closes.length < 6) {
            return 55;
          }

          const last = closes.at(-1) ?? 0;
          const prev = closes.at(-2) ?? last;
          const fiveAgo = closes.at(-6) ?? prev;
          const change1d = prev > 0 ? ((last - prev) / prev) * 100 : 0;
          const change5d = fiveAgo > 0 ? ((last - fiveAgo) / fiveAgo) * 100 : 0;
          return clamp(55 + change1d * 7 + change5d * 2.5, 15, 98);
        })
      );
    }

    return cache.get(etf)!;
  };
}

function buildMarketTone(indexMoves: Record<string, number>) {
  const growth = indexMoves.qqq ?? 0;
  const broad = indexMoves.spy ?? 0;
  const smallCaps = indexMoves.iwm ?? 0;
  const vix = indexMoves.vix ?? 0;

  if (growth > 0.6 && broad > 0.3 && vix <= 0.5) {
    return "risk-on" as const;
  }
  if (growth < -0.6 || broad < -0.5 || vix >= 2) {
    return "risk-off" as const;
  }
  return "balanced" as const;
}

async function buildMarketBrief(candidates: OvernightCandidate[], generatedAt: string): Promise<OvernightMarketBrief> {
  const indexSymbols = Object.values(marketIndexSymbols);
  const charts = await Promise.all(indexSymbols.map((symbol) => fetchYahooChartData(symbol, "5d", "1d", false)));

  const indexMap = Object.fromEntries(
    charts.map((chart) => {
      const prev = chart.bars.at(-2)?.close ?? chart.previousClose;
      const last = chart.bars.at(-1)?.close ?? chart.price;
      const changePct = prev > 0 ? ((last - prev) / prev) * 100 : 0;
      return [chart.symbol.toLowerCase().replace("^", ""), changePct];
    })
  );

  const topSectors = [...new Set(candidates.map((candidate) => candidate.sector))]
    .map((sector) => ({
      sector,
      score: average(candidates.filter((candidate) => candidate.sector === sector).map((candidate) => candidate.sectorMomentumScore))
    }))
    .sort((left, right) => right.score - left.score);

  const weakSectors = [...topSectors].reverse();
  const tone = buildMarketTone(indexMap);
  const standout = candidates.slice(0, 3).map((candidate) => `${candidate.ticker} ${candidate.dayChangePct >= 0 ? "+" : ""}${candidate.dayChangePct.toFixed(1)}%`);
  const qqqMove = indexMap.qqq ?? 0;
  const spyMove = indexMap.spy ?? 0;

  return {
    timestampLabel: `${new Intl.DateTimeFormat("en-US", {
      timeZone: overnightRuntime.marketTimezone,
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date(generatedAt))} ET`,
    marketTone: tone,
    closeCountdownMinutes: getCloseCountdownMinutes(new Date(generatedAt)),
    summary: `나스닥 ${qqqMove >= 0 ? "+" : ""}${qqqMove.toFixed(1)}%, S&P500 ${spyMove >= 0 ? "+" : ""}${spyMove.toFixed(
      1
    )}% 흐름입니다. 오늘은 ${topSectors[0]?.sector ?? "강한 섹터"} 쪽 종목이 종가 근처까지 버티는지에 초점을 두는 장입니다.`,
    indexFlow: [
      `QQQ ${qqqMove >= 0 ? "+" : ""}${qqqMove.toFixed(1)}%`,
      `SPY ${spyMove >= 0 ? "+" : ""}${spyMove.toFixed(1)}%`,
      `IWM ${(indexMap.iwm ?? 0) >= 0 ? "+" : ""}${(indexMap.iwm ?? 0).toFixed(1)}%`,
      `VIX ${(indexMap.vix ?? 0) >= 0 ? "+" : ""}${(indexMap.vix ?? 0).toFixed(1)}%`
    ],
    sectorLeaders: topSectors.slice(0, 3).map((item) => item.sector),
    weakGroups: weakSectors.slice(0, 3).map((item) => item.sector),
    riskFlags: candidates
      .filter(
        (candidate) =>
          (candidate.daysToEarnings >= 0 && candidate.daysToEarnings <= 3) || candidate.postMarketSuitability === "avoid"
      )
      .slice(0, 3)
      .map((candidate) => `${candidate.ticker} ${candidate.daysToEarnings <= 3 ? "실적 임박" : "애프터마켓 비적합"}`),
    standoutTickers: standout
  };
}

async function buildLiveUniverseSeeds() {
  const screenerResults = await Promise.all(
    overnightScreeners.map((screenId) => fetchYahooScreenerQuotes(screenId, overnightRuntime.screenerCount))
  );

  const merged = new Map<string, YahooScreenedQuote>();
  screenerResults.forEach((quotes) => {
    quotes.forEach((quote) => {
      const existing = merged.get(quote.symbol);
      if (existing) {
        existing.screeners = Array.from(new Set([...existing.screeners, ...quote.screeners]));
        if (quote.marketCapBn > existing.marketCapBn) {
          merged.set(quote.symbol, { ...existing, ...quote, screeners: existing.screeners });
        }
      } else {
        merged.set(quote.symbol, quote);
      }
    });
  });

  const rankedScreeners = [...merged.values()].sort((left, right) => rankScreenerQuote(right) - rankScreenerQuote(left));
  const reservedForFocus = Math.min(6, overnightRuntime.maxUniverseSymbols);
  const selected = rankedScreeners.slice(0, Math.max(overnightRuntime.maxUniverseSymbols - reservedForFocus, 0));
  const selectedSymbols = new Set(selected.map((item) => item.symbol));

  overnightFocusSymbols.forEach((symbol) => {
    if (!selectedSymbols.has(symbol) && selected.length < overnightRuntime.maxUniverseSymbols) {
      selected.push({
        symbol,
        companyName: symbol,
        price: 0,
        dayChangePct: 0,
        dayHigh: 0,
        dayLow: 0,
        volume: 0,
        averageVolume: 0,
        marketCapBn: 0,
        bid: null,
        ask: null,
        postMarketPrice: null,
        postMarketChangePct: 0,
        earningsDate: null,
        analystRating: null,
        trailingPe: null,
        marketState: "REGULAR",
        screeners: ["focus"]
      });
      selectedSymbols.add(symbol);
    }
  });

  return selected.slice(0, overnightRuntime.maxUniverseSymbols);
}

async function buildLiveCandidate(quoteSeed: YahooScreenedQuote, getSectorMomentum: Awaited<ReturnType<typeof buildSectorMomentumGetter>>) {
  const [search, daily, intraday, focusQuote] = await Promise.all([
    fetchYahooSearchBundle(quoteSeed.symbol, 6),
    fetchYahooChartData(quoteSeed.symbol, "6mo", "1d", false),
    fetchYahooChartData(quoteSeed.symbol, "1d", "1m", true),
    quoteSeed.marketCapBn > 0 && quoteSeed.averageVolume > 0 ? Promise.resolve<YahooScreenedQuote | null>(null) : fetchYahooFocusSymbolQuote(quoteSeed.symbol)
  ]);

  const quote = focusQuote ?? quoteSeed;
  const regularBars = filterRegularBars(intraday);
  const postBars = filterPostBars(intraday);
  if (regularBars.length < 60 || daily.bars.length < 25) {
    return null;
  }

  const close = regularBars.at(-1)?.close ?? intraday.price;
  const dayHigh = regularBars.reduce((max, bar) => Math.max(max, bar.high), close);
  const dayLow = regularBars.reduce((min, bar) => Math.min(min, bar.low), close);
  const vwap = computeVwap(regularBars);
  const last30Bars = regularBars.slice(-30);
  const priorRegularBars = regularBars.slice(0, -30);
  const last30Open = last30Bars[0]?.open ?? close;
  const closeStrength30m = last30Open > 0 ? ((close - last30Open) / last30Open) * 100 : 0;
  const averageMinuteVolume = average((priorRegularBars.length > 0 ? priorRegularBars : regularBars).map((bar) => bar.volume));
  const close30mVolumeRatio =
    averageMinuteVolume > 0 ? (sum(last30Bars.map((bar) => bar.volume)) / Math.max(last30Bars.length, 1)) / averageMinuteVolume : 1;
  const closeAuctionConcentration = intraday.regularVolume > 0 ? (sum(regularBars.slice(-10).map((bar) => bar.volume)) / intraday.regularVolume) * 100 : 0;
  const heavySelloffPenalty = clamp(
    Math.max(
      ...last30Bars.map((bar) => {
        const bodyPct = bar.open > 0 ? ((bar.close - bar.open) / bar.open) * 100 : 0;
        if (bodyPct >= 0) {
          return 0;
        }
        const volumeFactor = averageMinuteVolume > 0 ? bar.volume / averageMinuteVolume : 1;
        return Math.abs(bodyPct) * 6 + Math.max(volumeFactor - 1, 0) * 6;
      })
    ),
    0,
    25
  );

  const priorDailyBars = daily.bars.slice(0, -1);
  const previousDailyBars = priorDailyBars.slice(-20);
  const supportLevel = Math.min(...daily.bars.slice(-10).map((bar) => bar.low));
  const rawResistance = Math.max(...previousDailyBars.map((bar) => bar.high));
  const resistanceLevel = rawResistance > close ? rawResistance : close * 1.015;
  const distanceToResistancePct = resistanceLevel > close ? ((resistanceLevel - close) / close) * 100 : 0;
  const averageVolume = quote.averageVolume > 0 ? quote.averageVolume : average(previousDailyBars.map((bar) => bar.volume));
  const averageDollarVolumeM =
    average(
      previousDailyBars.map((bar) => {
        return ((bar.close + bar.open) / 2) * bar.volume;
      })
    ) / 1_000_000;
  const spreadBps = computeSpreadBps(quote, close, averageDollarVolumeM);
  const rvol20 = averageVolume > 0 ? intraday.regularVolume / averageVolume : 1;
  const afterHoursVolumeRatio = intraday.regularVolume > 0 ? sum(postBars.map((bar) => bar.volume)) / intraday.regularVolume : 0;
  const afterHoursLast = postBars.at(-1)?.close ?? quote.postMarketPrice ?? close;
  const afterHoursChangePct = close > 0 ? ((afterHoursLast - close) / close) * 100 : quote.postMarketChangePct;
  const afterHoursSpreadStable = computeAfterHoursSpreadStable(spreadBps, afterHoursVolumeRatio, quote.marketCapBn);
  const news = buildNewsItems(quote.symbol, search.news);
  const newsScores = buildNewsScores(news, quote.analystRating, quote.screeners);
  const sectorMomentumScore = await getSectorMomentum(search.sector, search.industry);
  const backtest = buildTradeSeriesLookback(
    daily.bars
      .slice(-(overnightRuntime.backtestLookbackSessions + 1))
      .map((bar) => ({
        date: toIsoDateInTimezone(bar.date, overnightRuntime.marketTimezone),
        open: bar.open,
        high: bar.high,
        close: bar.close
      }))
  );

  const premarketInterestScore = clamp(
    40 +
      (quote.screeners.includes("day_gainers") ? 18 : 0) +
      (quote.screeners.includes("most_actives") ? 14 : 0) +
      (quote.screeners.includes("growth_technology_stocks") ? 10 : 0) +
      news.filter((item) => item.sentiment === "positive").length * 8 +
      (afterHoursChangePct > 0 ? 8 : 0) +
      backtest.gapUpRatePct * 0.12,
    15,
    98
  );

  const postMarketSuitability = determinePostMarketSuitability(
    spreadBps,
    averageDollarVolumeM,
    newsScores.negativeHeadlinePenalty,
    afterHoursVolumeRatio
  );
  const rawDaysToEarnings = daysUntil(quote.earningsDate);
  const normalizedDaysToEarnings = rawDaysToEarnings < 0 ? 999 : rawDaysToEarnings;

  const raw: OvernightRawCandidate = {
    ticker: quote.symbol,
    companyName: search.companyName ?? quote.companyName,
    sector: search.sector,
    industry: search.industry,
    universeTags: quote.screeners,
    price: close,
    dayChangePct: quote.price > 0 ? quote.dayChangePct : intraday.previousClose > 0 ? ((close - intraday.previousClose) / intraday.previousClose) * 100 : 0,
    dayHigh,
    dayLow,
    close,
    vwap,
    marketCapBn: quote.marketCapBn,
    averageVolume,
    averageDollarVolumeM,
    spreadBps,
    closeStrength30m,
    close30mVolumeRatio,
    rvol20,
    closeAuctionConcentration,
    heavySelloffPenalty,
    earningsSurpriseScore: newsScores.earningsScore,
    guidanceScore: newsScores.guidanceScore,
    contractScore: newsScores.contractScore,
    policyScore: newsScores.policyScore,
    analystScore: newsScores.analystScore,
    themeScore: newsScores.themeScore,
    negativeHeadlinePenalty: newsScores.negativeHeadlinePenalty,
    dilutionPenalty: newsScores.dilutionPenalty,
    litigationPenalty: newsScores.litigationPenalty,
    sectorMomentumScore,
    premarketInterestScore,
    afterHoursChangePct,
    afterHoursVolumeRatio,
    afterHoursSpreadStable,
    distanceToResistancePct,
    daysToEarnings: normalizedDaysToEarnings,
    supportLevel,
    resistanceLevel,
    postMarketSuitability,
    marketState: intraday.marketState || quote.marketState,
    news,
    backtest
  };

  return raw;
}

function buildAlerts(candidates: OvernightCandidate[]): OvernightAlert[] {
  const topA = candidates.filter((candidate) => candidate.score.grade === "A").slice(0, 3);
  const postCandidates = candidates.filter((candidate) => candidate.postMarketSuitability === "ideal").slice(0, 3);

  return [
    {
      id: "grade-a",
      title: "A급 발생",
      detail: topA.length > 0 ? `${topA.map((item) => item.ticker).join(", ")} 가 현재 A급입니다.` : "현재 A급 후보는 없습니다.",
      severity: "high"
    },
    {
      id: "top5",
      title: "장마감 직전 TOP 5",
      detail: candidates.slice(0, 5).map((item) => item.ticker).join(", "),
      severity: "medium"
    },
    {
      id: "after-hours",
      title: "포스트마켓 적합",
      detail: postCandidates.length > 0 ? `${postCandidates.map((item) => item.ticker).join(", ")} 는 포스트마켓 매수 적합으로 분류됩니다.` : "포스트마켓 적합 종목은 제한적입니다.",
      severity: "low"
    }
  ];
}

async function saveSnapshotIfNeeded(data: OvernightDashboardData) {
  if (!overnightRuntime.snapshotEnabled) {
    return;
  }

  const shouldCapture = data.marketBrief.closeCountdownMinutes <= 20 || data.topCandidates.some((candidate) => candidate.marketState.includes("POST"));
  if (!shouldCapture) {
    return;
  }

  const sessionDate = toIsoDateInTimezone(data.generatedAt, overnightRuntime.marketTimezone);
  const snapshotId = buildSnapshotId(sessionDate, data.generatedAt);
  if (snapshotExists(snapshotId)) {
    return;
  }

  const snapshot: StoredOvernightSnapshot = {
    id: snapshotId,
    sessionDate,
    recordedAt: data.generatedAt,
    candidates: data.topCandidates.slice(0, 10).map((candidate) => ({
      ticker: candidate.ticker,
      companyName: candidate.companyName,
      close: candidate.price,
      score: candidate.score.total,
      grade: candidate.score.grade,
      postMarketSuitability: candidate.postMarketSuitability
    }))
  };

  saveOvernightSnapshot(snapshot);
}

async function buildLiveDashboardData(settings: OvernightSettings): Promise<OvernightDashboardData> {
  const generatedAt = new Date().toISOString();
  const status: OvernightDataStatus = {
    mode: "live",
    provider: overnightRuntime.provider,
    warning: "Yahoo 공개 데이터 기반입니다. 실시간성은 높지만 공식 브로커 체결 데이터와 차이가 있을 수 있습니다.",
    notes: ["실시간 가격/뉴스/애프터마켓 반영", "백테스트는 저장 스냅샷 + 최근 20거래일 프록시 기반"],
    lastSuccessfulAt: generatedAt
  };

  const seeds = await buildLiveUniverseSeeds();
  const getSectorMomentum = await buildSectorMomentumGetter();
  const rawCandidates = (
    await Promise.allSettled(seeds.map((seed) => buildLiveCandidate(seed, getSectorMomentum)))
  )
    .flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
    .filter((item): item is OvernightRawCandidate => Boolean(item));

  const candidates = rawCandidates
    .map((item) => scoreOvernightCandidate(item, settings))
    .filter((candidate) => passesFilters(candidate, settings))
    .sort((left, right) => right.score.total - left.score.total);

  const marketBrief = await buildMarketBrief(candidates, generatedAt);
  const data: OvernightDashboardData = {
    generatedAt,
    status,
    marketBrief,
    settings,
    candidates,
    topCandidates: candidates.slice(0, 10),
    alerts: buildAlerts(candidates),
    universeCount: rawCandidates.length,
    strategyBacktest: await buildStoredSnapshotBacktest()
  };

  await saveSnapshotIfNeeded(data);
  return data;
}

function buildMockDashboardData(settings: OvernightSettings): OvernightDashboardData {
  const candidates = mockOvernightUniverse
    .map((item) => scoreOvernightCandidate(item, settings))
    .filter((candidate) => passesFilters(candidate, settings))
    .sort((left, right) => right.score.total - left.score.total);

  return {
    generatedAt: new Date().toISOString(),
    status: {
      mode: "mock",
      provider: "Mock provider",
      warning: "현재는 샘플 데이터입니다.",
      notes: ["설정과 UI 검증용 샘플"],
      lastSuccessfulAt: new Date().toISOString()
    },
    marketBrief: mockOvernightMarketBrief,
    settings,
    candidates,
    topCandidates: candidates.slice(0, 10),
    alerts: buildAlerts(candidates),
    universeCount: mockOvernightUniverse.length,
    strategyBacktest: null
  };
}

export async function getOvernightDashboardData(settingsInput?: Partial<OvernightSettings>): Promise<OvernightDashboardData> {
  const settings = normalizeOvernightSettings(settingsInput);
  const cacheKey = getCacheKey(settings);
  const cached = dashboardCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const data =
    overnightRuntime.mode === "mock" ? buildMockDashboardData(settings) : await buildLiveDashboardData(settings);

  dashboardCache.set(cacheKey, {
    expiresAt: Date.now() + overnightRuntime.cacheTtlMs,
    data
  });
  return data;
}

export async function getOvernightCandidateDetail(ticker: string, settingsInput?: Partial<OvernightSettings>) {
  const data = await getOvernightDashboardData(settingsInput ?? defaultOvernightSettings);
  return data.candidates.find((candidate) => candidate.ticker === ticker.toUpperCase()) ?? null;
}
