import { listOvernightSnapshots, saveOvernightSnapshot, snapshotExists } from "@/db/overnight-snapshot-repository";
import { defaultOvernightSettings, normalizeOvernightSettings } from "@/lib/overnight-defaults";
import { inferSectorEtf, marketIndexSymbols, overnightFocusSymbols, overnightScreeners } from "@/lib/overnight-universe";
import { overnightRuntime } from "@/lib/overnight-runtime";
import {
  OvernightAfterHoursRadar,
  CatalystTag,
  OvernightAlert,
  OvernightCandidate,
  OvernightDashboardData,
  OvernightDataStatus,
  OvernightDecisionState,
  OvernightMarketBrief,
  OvernightNewsItem,
  OvernightRawCandidate,
  OvernightSettings,
  PostMarketSuitability,
  StoredOvernightSnapshot
} from "@/lib/overnight-types";
import { average, clamp, daysUntil, round1, sum, toIsoDateInTimezone } from "@/lib/utils";
import { mockOvernightMarketBrief, mockOvernightUniverse } from "@/providers/mock/overnight-mock";
import { buildSyncKeySegment, normalizeSyncKey } from "@/lib/overnight-sync";
import { fetchSp500Constituents } from "@/providers/live/sp500-constituents";
import {
  fetchYahooChartData,
  fetchYahooFocusSymbolQuote,
  fetchYahooSparkBatch,
  fetchYahooScreenerQuotes,
  fetchYahooSearchBundle,
  YahooChartData,
  YahooSparkQuote,
  YahooScreenedQuote
} from "@/providers/live/yahoo-overnight";
import { scoreOvernightCandidate } from "@/scoring/overnight-engine";
import { buildPreviousSnapshotReview, buildStoredSnapshotBacktest, buildTradeSeriesLookback } from "@/services/overnight-backtest-service";
import { buildOvernightTradeJournal } from "@/services/overnight-trade-journal-service";

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

function passesBaselineFilters(candidate: OvernightCandidate, settings: OvernightSettings) {
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
  if (settings.excludeUpcomingEarnings && hasUpcomingEarningsRisk) {
    return false;
  }
  if (!settings.allowPostMarket && candidate.postMarketSuitability === "avoid") {
    return false;
  }
  return true;
}

function passesAfterHoursRadarFilters(candidate: OvernightCandidate, settings: OvernightSettings) {
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

const marketTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: overnightRuntime.marketTimezone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

function getMarketTimeParts(timestamp: number) {
  const parts = Object.fromEntries(
    marketTimeFormatter
      .formatToParts(new Date(timestamp * 1000))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    sessionDate: `${parts.year}-${parts.month}-${parts.day}`,
    minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute)
  };
}

function getMarketSessionDate(timestamp: number) {
  return getMarketTimeParts(timestamp).sessionDate;
}

function getMarketMinuteOfDay(timestamp: number) {
  return getMarketTimeParts(timestamp).minuteOfDay;
}

function filterRegularBars(chart: YahooChartData) {
  if (chart.bars.length === 0) {
    return [];
  }

  const sessionDate = getMarketSessionDate(chart.bars.at(-1)!.time);
  return chart.bars.filter((bar) => {
    const marketTime = getMarketMinuteOfDay(bar.time);
    return getMarketSessionDate(bar.time) === sessionDate && marketTime >= 570 && marketTime <= 960;
  });
}

function filterPostBars(chart: YahooChartData) {
  if (chart.bars.length === 0) {
    return [];
  }

  const sessionDate = getMarketSessionDate(chart.bars.at(-1)!.time);
  return chart.bars.filter((bar) => {
    const marketTime = getMarketMinuteOfDay(bar.time);
    return getMarketSessionDate(bar.time) === sessionDate && marketTime > 960 && marketTime <= 1200;
  });
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

function scale(value: number, min: number, max: number): number {
  if (max <= min) {
    return 0;
  }

  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

function invertScale(value: number, min: number, max: number): number {
  return 100 - scale(value, min, max);
}

function buildSnapshotId(sessionDate: string, recordedAt: string, syncKey?: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: overnightRuntime.marketTimezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const [hourText, minuteText] = formatter.format(new Date(recordedAt)).split(":");
  const minuteBucket = Math.floor(Number(minuteText) / 15) * 15;
  return `${buildSyncKeySegment(syncKey)}-${sessionDate}-${hourText}${String(minuteBucket).padStart(2, "0")}`;
}

function mergeSnapshotHistory(syncKey: string, clientSnapshotHistory?: StoredOvernightSnapshot[]) {
  const merged = new Map<string, StoredOvernightSnapshot>();
  const normalizedSyncKey = normalizeSyncKey(syncKey) || null;

  listOvernightSnapshots(40, syncKey).forEach((snapshot) => {
    merged.set(snapshot.id, snapshot);
  });

  (clientSnapshotHistory ?? []).forEach((snapshot) => {
    if (!snapshot?.id || !snapshot?.recordedAt || !snapshot?.sessionDate) {
      return;
    }
    if ((normalizeSyncKey(snapshot.syncKey) || null) !== normalizedSyncKey) {
      return;
    }
    merged.set(snapshot.id, snapshot);
  });

  return [...merged.values()].sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));
}

function getEntryWindowSnapshot(sessionDate: string, snapshots: StoredOvernightSnapshot[]) {
  const sameSession = snapshots.filter((snapshot) => snapshot.sessionDate === sessionDate);
  const preClose = sameSession.find((snapshot) => {
    const recordedMinute = getMarketMinuteOfDay(Math.floor(new Date(snapshot.recordedAt).getTime() / 1000));
    return recordedMinute >= 945 && recordedMinute <= 960;
  });

  if (preClose) {
    return preClose;
  }

  return sameSession.find((snapshot) => {
    const recordedMinute = getMarketMinuteOfDay(Math.floor(new Date(snapshot.recordedAt).getTime() / 1000));
    return recordedMinute >= 945;
  }) ?? null;
}

function buildDecisionState(
  generatedAt: string,
  currentSessionDate: string,
  lockedSnapshot: StoredOvernightSnapshot | null
): OvernightDecisionState {
  if (lockedSnapshot) {
    return {
      mode: "locked-close",
      sessionDate: currentSessionDate,
      recordedAt: lockedSnapshot.recordedAt,
      summary: `오늘 종가 픽은 ${new Intl.DateTimeFormat("ko-KR", {
        timeZone: overnightRuntime.marketTimezone,
        hour: "numeric",
        minute: "2-digit"
      }).format(new Date(lockedSnapshot.recordedAt))} ET 기준으로 고정되고, 이후에는 애프터마켓 변화만 덧붙입니다.`
    };
  }

  return {
    mode: "live-window",
    sessionDate: currentSessionDate,
    recordedAt: null,
    summary: `아직 마감 직전 확정 픽이 잠기지 않았습니다. ${new Intl.DateTimeFormat("ko-KR", {
      timeZone: overnightRuntime.marketTimezone,
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(generatedAt))} ET 기준 실시간 후보입니다.`
  };
}

async function buildLockedTopCandidates(
  lockedSnapshot: StoredOvernightSnapshot | null,
  candidateMap: Map<string, OvernightCandidate>,
  getSectorMomentum: Awaited<ReturnType<typeof buildSectorMomentumGetter>>,
  settings: OvernightSettings
) {
  if (!lockedSnapshot) {
    return [];
  }

  const resolved: OvernightCandidate[] = [];

  for (const stored of lockedSnapshot.candidates.slice(0, 3)) {
    const existing = candidateMap.get(stored.ticker);
    if (existing) {
      resolved.push(existing);
      continue;
    }

    try {
      const raw = await buildLiveCandidate(
        {
          symbol: stored.ticker,
          companyName: stored.companyName,
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
          screeners: ["snapshot"]
        },
        getSectorMomentum
      );

      if (raw) {
        resolved.push(scoreOvernightCandidate(raw, settings));
      }
    } catch {
      // Keep the remaining locked candidates available even if one refresh fails.
    }
  }

  return resolved;
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

function scoreSparkSeed(quote: YahooSparkQuote, screeners: string[]) {
  const closeSeries = quote.closes;
  const last = closeSeries.at(-1) ?? quote.price;
  const thirtyMinuteSpan = closeSeries.length >= 7 ? closeSeries.slice(-7) : closeSeries;
  const thirtyMinuteBase = thirtyMinuteSpan[0] ?? last;
  const closeStrength30m = thirtyMinuteBase > 0 ? ((last - thirtyMinuteBase) / thirtyMinuteBase) * 100 : 0;
  const closeToHighPct = quote.dayHigh > 0 ? ((quote.dayHigh - last) / quote.dayHigh) * 100 : 0;
  const dayChangePct = quote.previousClose > 0 ? ((quote.price - quote.previousClose) / quote.previousClose) * 100 : 0;
  const dayChangePctScore = (() => {
    if (dayChangePct >= 2 && dayChangePct <= 8) {
      return 100;
    }
    if (dayChangePct > 8 && dayChangePct <= 15) {
      return scale(15 - dayChangePct, 0, 7) * 0.7 + 30;
    }
    if (dayChangePct > 0 && dayChangePct < 2) {
      return scale(dayChangePct, 0, 2) * 0.6 + 20;
    }
    return scale(dayChangePct, -5, 0) * 0.3;
  })();
  const dollarVolumeM = (quote.price * quote.regularVolume) / 1_000_000;
  const screenerBonus =
    (screeners.includes("day_gainers") ? 14 : 0) +
    (screeners.includes("most_actives") ? 10 : 0) +
    (screeners.includes("growth_technology_stocks") ? 8 : 0);

  return (
    scale(quote.price, 10, 500) * 0.04 +
    dayChangePctScore * 0.22 +
    invertScale(closeToHighPct, 0, 8) * 0.26 +
    scale(closeStrength30m, -0.5, 3) * 0.28 +
    scale(dollarVolumeM, 25, 2_500) * 0.12 +
    scale(quote.regularVolume, 500_000, 80_000_000) * 0.08 +
    screenerBonus
  );
}

function buildSparkSeed(
  quote: YahooSparkQuote,
  companyName: string,
  screeners: string[]
): YahooScreenedQuote {
  return {
    symbol: quote.symbol,
    companyName,
    price: quote.price,
    dayChangePct: quote.previousClose > 0 ? ((quote.price - quote.previousClose) / quote.previousClose) * 100 : 0,
    dayHigh: quote.dayHigh,
    dayLow: quote.dayLow,
    volume: quote.regularVolume,
    averageVolume: 0,
    marketCapBn: 0,
    bid: null,
    ask: null,
    postMarketPrice: null,
    postMarketChangePct: 0,
    earningsDate: null,
    analystRating: null,
    trailingPe: null,
    marketState: quote.marketState,
    screeners
  };
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
  const constituents = await fetchSp500Constituents();
  const constituentMap = new Map(constituents.map((item) => [item.symbol, item]));
  const constituentSymbols = constituents.map((item) => item.symbol);
  const constituentSet = new Set(constituentSymbols);

  const screenerResults = await Promise.all(
    overnightScreeners.map((screenId) => fetchYahooScreenerQuotes(screenId, overnightRuntime.screenerCount))
  );
  const screenerMap = new Map<string, string[]>();
  screenerResults.forEach((quotes) => {
    quotes.forEach((quote) => {
      if (!constituentSet.has(quote.symbol)) {
        return;
      }

      const existing = screenerMap.get(quote.symbol) ?? [];
      screenerMap.set(quote.symbol, Array.from(new Set([...existing, ...quote.screeners])));
    });
  });

  const sparkQuotes: YahooSparkQuote[] = [];
  const batchSize = 50;
  const symbolBatches: string[][] = [];
  for (let index = 0; index < constituentSymbols.length; index += batchSize) {
    symbolBatches.push(constituentSymbols.slice(index, index + batchSize));
  }

  const sparkBatchResults = await Promise.all(symbolBatches.map((batch) => fetchYahooSparkBatch(batch, "1d", "5m", true)));
  sparkBatchResults.forEach((batchQuotes) => {
    sparkQuotes.push(...batchQuotes);
  });

  const rankedSeeds = sparkQuotes
    .map((quote) => {
      const constituent = constituentMap.get(quote.symbol);
      if (!constituent || quote.price <= 0) {
        return null;
      }

      const screeners = Array.from(new Set(["sp500", ...(screenerMap.get(quote.symbol) ?? [])]));
      return {
        score: scoreSparkSeed(quote, screeners),
        seed: buildSparkSeed(quote, constituent.companyName, screeners)
      };
    })
    .filter((item): item is { score: number; seed: YahooScreenedQuote } => Boolean(item))
    .sort((left, right) => right.score - left.score);

  const prioritySymbols = overnightFocusSymbols.filter((symbol) => constituentSet.has(symbol));
  const reservedForPriority = Math.min(Math.max(10, Math.floor(overnightRuntime.maxUniverseSymbols / 3)), overnightRuntime.maxUniverseSymbols);
  const selected = rankedSeeds
    .slice(0, Math.max(overnightRuntime.maxUniverseSymbols - reservedForPriority, 0))
    .map((item) => item.seed);
  const selectedSymbols = new Set(selected.map((item) => item.symbol));

  prioritySymbols.forEach((symbol) => {
    if (selected.length >= overnightRuntime.maxUniverseSymbols || selectedSymbols.has(symbol)) {
      return;
    }

    const constituent = constituentMap.get(symbol);
    if (!constituent) {
      return;
    }

    selected.push({
      symbol,
      companyName: constituent.companyName,
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
      screeners: ["sp500", "focus", "priority"]
    });
    selectedSymbols.add(symbol);
  });

  return {
    seeds: selected.slice(0, overnightRuntime.maxUniverseSymbols),
    universeCount: constituents.length,
    prioritySymbols
  };
}

async function buildLiveCandidate(quoteSeed: YahooScreenedQuote, getSectorMomentum: Awaited<ReturnType<typeof buildSectorMomentumGetter>>) {
  const [search, daily, intraday, focusQuote] = await Promise.all([
    fetchYahooSearchBundle(quoteSeed.symbol, 4),
    fetchYahooChartData(quoteSeed.symbol, "3mo", "1d", false),
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
    38 +
      (quote.screeners.includes("day_gainers") ? 18 : 0) +
      (quote.screeners.includes("most_actives") ? 14 : 0) +
      (quote.screeners.includes("growth_technology_stocks") ? 10 : 0) +
      news.filter((item) => item.sentiment === "positive").length * 8 +
      (afterHoursChangePct >= 3 ? 18 : afterHoursChangePct >= 1 ? 10 : afterHoursChangePct > 0 ? 5 : 0) +
      backtest.gapUpRatePct * 0.22 +
      (closeStrength30m >= 1.5 ? 8 : closeStrength30m >= 0.5 ? 4 : 0),
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

async function collectLiveCandidates(
  seeds: YahooScreenedQuote[],
  getSectorMomentum: Awaited<ReturnType<typeof buildSectorMomentumGetter>>
) {
  const results: OvernightRawCandidate[] = [];
  const batchSize = 12;

  for (let index = 0; index < seeds.length; index += batchSize) {
    const batch = seeds.slice(index, index + batchSize);
    const settled = await Promise.allSettled(batch.map((seed) => buildLiveCandidate(seed, getSectorMomentum)));

    settled.forEach((result) => {
      if (result.status === "fulfilled" && result.value) {
        results.push(result.value);
      }
    });
  }

  return results;
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

function buildAfterHoursRadar(
  scoredCandidates: OvernightCandidate[],
  topCandidates: OvernightCandidate[],
  decisionState: OvernightDecisionState,
  settings: OvernightSettings
): OvernightAfterHoursRadar | null {
  const topTickerSet = new Set(topCandidates.map((candidate) => candidate.ticker));

  const ranked = scoredCandidates
    .filter((candidate) => passesAfterHoursRadarFilters(candidate, settings))
    .filter((candidate) => candidate.afterHoursChangePct >= 2)
    .filter((candidate) =>
      candidate.news.some((item) =>
        item.catalyst === "earnings" ||
        item.catalyst === "guidance" ||
        item.catalyst === "analyst" ||
        item.catalyst === "contract"
      )
    )
    .sort((left, right) => {
      const leftEventHits = left.news.filter((item) => item.catalyst === "earnings" || item.catalyst === "guidance").length;
      const rightEventHits = right.news.filter((item) => item.catalyst === "earnings" || item.catalyst === "guidance").length;
      const leftScore =
        left.afterHoursChangePct * 4 +
        left.score.catalystMomentum * 0.7 +
        left.score.nextDayRealizability * 0.5 +
        leftEventHits * 12 +
        (left.postMarketSuitability === "ideal" ? 10 : left.postMarketSuitability === "allowed" ? 4 : 0);
      const rightScore =
        right.afterHoursChangePct * 4 +
        right.score.catalystMomentum * 0.7 +
        right.score.nextDayRealizability * 0.5 +
        rightEventHits * 12 +
        (right.postMarketSuitability === "ideal" ? 10 : right.postMarketSuitability === "allowed" ? 4 : 0);
      return rightScore - leftScore;
    });

  const extraCandidates = ranked.filter((candidate) => !topTickerSet.has(candidate.ticker)).slice(0, 3);
  const fallbackCandidates = ranked.slice(0, 3);
  const candidates = extraCandidates.length > 0 ? extraCandidates : fallbackCandidates;

  if (candidates.length === 0) {
    return null;
  }

  return {
    summary:
      decisionState.mode === "locked-close"
        ? "오늘 종가 확정 픽과 별개로, 장후 실적·가이던스 반응이 새로 붙은 종목입니다. 이미 들고 가는 픽을 바꾸는 용도보다 장후 추격/익일 시초 관찰용 레이더로 보시면 됩니다."
        : "마감 이후 실적·가이던스·애널리스트 재료로 장후에 급등한 종목을 따로 압축한 레이더입니다. 종가베팅 픽과는 다른 이벤트 드리븐 플레이북으로 보시면 됩니다.",
    candidates
  };
}

async function saveSnapshotIfNeeded(data: OvernightDashboardData, syncKey: string) {
  if (!overnightRuntime.snapshotEnabled) {
    return;
  }

  const shouldCapture = data.marketBrief.closeCountdownMinutes <= 20 || data.topCandidates.some((candidate) => candidate.marketState.includes("POST"));
  if (!shouldCapture) {
    return;
  }

  const sessionDate = toIsoDateInTimezone(data.generatedAt, overnightRuntime.marketTimezone);
  const snapshotId = buildSnapshotId(sessionDate, data.generatedAt, syncKey);
  if (snapshotExists(snapshotId)) {
    return;
  }

  const snapshot: StoredOvernightSnapshot = {
    id: snapshotId,
    syncKey: normalizeSyncKey(syncKey) || null,
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

async function buildLiveDashboardData(
  settings: OvernightSettings,
  clientSnapshotHistory?: StoredOvernightSnapshot[]
): Promise<OvernightDashboardData> {
  const generatedAt = new Date().toISOString();
  const currentSessionDate = toIsoDateInTimezone(generatedAt, overnightRuntime.marketTimezone);
  const currentMarketMinute = getMarketMinuteOfDay(Math.floor(new Date(generatedAt).getTime() / 1000));
  const snapshotHistory = mergeSnapshotHistory(settings.syncKey, clientSnapshotHistory);
  const status: OvernightDataStatus = {
    mode: "live",
    provider: overnightRuntime.provider,
    warning: "Yahoo 공개 데이터 기반입니다. 실시간성은 높지만 공식 브로커 체결 데이터와 차이가 있을 수 있습니다.",
    notes: ["S&P500 전체 프리스캔 후 상위 종목 상세 계산", "실시간 가격/뉴스/애프터마켓 반영", "백테스트는 저장 스냅샷 + 최근 20거래일 프록시 기반"],
    lastSuccessfulAt: generatedAt
  };

  const { seeds, universeCount, prioritySymbols } = await buildLiveUniverseSeeds();
  const getSectorMomentum = await buildSectorMomentumGetter();
  const rawCandidates = await collectLiveCandidates(seeds, getSectorMomentum);
  const loadedSymbols = new Set(rawCandidates.map((candidate) => candidate.ticker));
  const missingFocusSeeds = seeds.filter((seed) => seed.screeners.includes("focus") && !loadedSymbols.has(seed.symbol));

  for (const seed of missingFocusSeeds) {
    try {
      const retried = await buildLiveCandidate(seed, getSectorMomentum);
      if (retried && !loadedSymbols.has(retried.ticker)) {
        rawCandidates.push(retried);
        loadedSymbols.add(retried.ticker);
      }
    } catch {
      // Ignore a second failure and keep the rest of the dashboard responsive.
    }
  }

  const scoredCandidates = rawCandidates
    .map((item) => scoreOvernightCandidate(item, settings))
    .sort((left, right) => right.score.total - left.score.total);
  const candidates = scoredCandidates.filter((candidate) => passesFilters(candidate, settings));
  const candidateSymbols = new Set(candidates.map((candidate) => candidate.ticker));

  for (const symbol of prioritySymbols) {
    if (candidateSymbols.has(symbol) || candidates.length >= 10) {
      continue;
    }

    try {
      const raw = await buildLiveCandidate(
        {
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
        },
        getSectorMomentum
      );
      if (!raw) {
        continue;
      }

      const scored = scoreOvernightCandidate(raw, settings);
      if (passesFilters(scored, settings) && !candidateSymbols.has(scored.ticker)) {
        candidates.push(scored);
        candidateSymbols.add(scored.ticker);
      }
    } catch {
      // Ignore focus fallback failures and keep the dashboard available.
    }
  }

  candidates.sort((left, right) => right.score.total - left.score.total);

  const displayCandidates = [...candidates];
  if (displayCandidates.length < 3) {
    const nearMisses = scoredCandidates
      .filter((candidate) => !candidateSymbols.has(candidate.ticker))
      .filter((candidate) => passesBaselineFilters(candidate, settings))
      .filter((candidate) => candidate.score.total >= 58)
      .sort((left, right) => right.score.total - left.score.total);

    for (const candidate of nearMisses) {
      if (displayCandidates.length >= 3) {
        break;
      }
      displayCandidates.push(candidate);
      candidateSymbols.add(candidate.ticker);
    }
  }

  displayCandidates.sort((left, right) => right.score.total - left.score.total);
  const candidateMap = new Map(displayCandidates.map((candidate) => [candidate.ticker, candidate]));
  const lockedSnapshot = currentMarketMinute >= 960 ? getEntryWindowSnapshot(currentSessionDate, snapshotHistory) ?? null : null;
  const lockedTopCandidates = await buildLockedTopCandidates(lockedSnapshot, candidateMap, getSectorMomentum, settings);
  const topCandidates = lockedSnapshot ? lockedTopCandidates : displayCandidates.slice(0, 3);
  const decisionState = buildDecisionState(generatedAt, currentSessionDate, lockedSnapshot);
  const afterHoursRadar = buildAfterHoursRadar(displayCandidates, topCandidates, decisionState, settings);

  const marketBrief = await buildMarketBrief(displayCandidates, generatedAt);
  const [strategyBacktest, previousReview, tradeJournal] = await Promise.all([
    buildStoredSnapshotBacktest(snapshotHistory),
    buildPreviousSnapshotReview(currentSessionDate, snapshotHistory),
    buildOvernightTradeJournal(currentSessionDate, settings.syncKey)
  ]);
  const data: OvernightDashboardData = {
    generatedAt,
    status,
    marketBrief,
    settings,
    candidates: displayCandidates,
    topCandidates,
    afterHoursRadar,
    decisionState,
    alerts: buildAlerts(displayCandidates),
    universeCount,
    strategyBacktest,
    previousReview,
    tradeJournal
  };

  await saveSnapshotIfNeeded(data, settings.syncKey);
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
    topCandidates: candidates.slice(0, 3),
    afterHoursRadar: null,
    decisionState: {
      mode: "live-window",
      sessionDate: toIsoDateInTimezone(new Date(), overnightRuntime.marketTimezone),
      recordedAt: null,
      summary: "현재는 샘플 모드라 확정 픽 고정이 동작하지 않습니다."
    },
    alerts: buildAlerts(candidates),
    universeCount: mockOvernightUniverse.length,
    strategyBacktest: null,
    previousReview: null,
    tradeJournal: {
      syncKey: settings.syncKey || null,
      summary: "모의 모드에서는 실전 테스트 기록판이 비어 있습니다.",
      activeEntries: [],
      recentResults: [],
      totalTracked: 0,
      completedTrades: 0,
      successRatePct: 0,
      averageGapPct: 0,
      averageHighPct: 0,
      averageClosePct: 0
    }
  };
}

export async function getOvernightDashboardData(
  settingsInput?: Partial<OvernightSettings>,
  clientSnapshotHistory?: StoredOvernightSnapshot[]
): Promise<OvernightDashboardData> {
  const settings = normalizeOvernightSettings(settingsInput);
  const cacheKey = `${getCacheKey(settings)}:${JSON.stringify(clientSnapshotHistory?.map((snapshot) => snapshot.id) ?? [])}`;
  const cached = dashboardCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const data =
    overnightRuntime.mode === "mock" ? buildMockDashboardData(settings) : await buildLiveDashboardData(settings, clientSnapshotHistory);

  dashboardCache.set(cacheKey, {
    expiresAt: Date.now() + overnightRuntime.cacheTtlMs,
    data
  });
  return data;
}

export async function getOvernightCandidateDetail(ticker: string, settingsInput?: Partial<OvernightSettings>) {
  const data = await getOvernightDashboardData(settingsInput ?? defaultOvernightSettings);
  const normalizedTicker = ticker.toUpperCase();
  const existing = data.candidates.find((candidate) => candidate.ticker === normalizedTicker);
  if (existing) {
    return existing;
  }

  if (overnightRuntime.mode === "mock") {
    return null;
  }

  const getSectorMomentum = await buildSectorMomentumGetter();
  const raw = await buildLiveCandidate(
    {
      symbol: normalizedTicker,
      companyName: normalizedTicker,
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
    },
    getSectorMomentum
  );

  return raw ? scoreOvernightCandidate(raw, normalizeOvernightSettings(settingsInput)) : null;
}
