import {
  AIProvider,
  CalendarProvider,
  CandidateStock,
  EconomicEvent,
  FundamentalsProvider,
  InstrumentSnapshot,
  MarketDataProvider,
  NewsItem,
  NewsProvider,
  PricePoint,
  StockEvent,
  StockNarrative,
  StockProfile,
  StockSnapshot
} from "@/lib/types";
import { getLocalizedStockDescription, getLocalizedStockEventNote } from "@/lib/localization";
import { average, clamp, getDateOffset, movingAverage } from "@/lib/utils";
import type { MarketRegime } from "@/lib/types";
import { FmpClient } from "@/providers/live/fmp-client";
import { fetchYahooHistory } from "@/providers/live/yahoo-chart";
import { TemplateAIProvider } from "@/providers/mock/mock-providers";

type FmpQuote = {
  symbol?: string;
  name?: string;
  price?: number | string;
  previousClose?: number | string;
  changePercentage?: number | string;
  changesPercentage?: number | string;
  change?: number | string;
  volume?: number | string;
  marketCap?: number | string;
  avgVolume?: number | string;
  pe?: number | string;
  priceAvg50?: number | string;
  priceAvg200?: number | string;
  yearHigh?: number | string;
  yearLow?: number | string;
};

type FmpProfile = {
  symbol?: string;
  companyName?: string;
  sector?: string;
  industry?: string;
  description?: string;
  beta?: number | string;
  mktCap?: number | string;
  price?: number | string;
};

type FmpHistoricalPoint = {
  date?: string;
  close?: number | string;
  volume?: number | string;
};

type FmpHistoricalResponse = FmpHistoricalPoint[] | { historical?: FmpHistoricalPoint[] };

type FmpNews = {
  symbol?: string;
  title?: string;
  site?: string;
  publishedDate?: string;
  text?: string;
  url?: string;
};

type FmpEarningsSurprise = {
  date?: string;
  estimatedEarning?: number | string;
  actualEarningResult?: number | string;
};

type FmpEarningsCalendar = {
  symbol?: string;
  date?: string;
};

type FmpPriceChange = {
  symbol?: string;
  "1D"?: number | string;
  "5D"?: number | string;
  "1M"?: number | string;
  "3M"?: number | string;
  "6M"?: number | string;
  ytd?: number | string;
  "1Y"?: number | string;
};

type FmpTreasuryRate = {
  date?: string;
  year2?: number | string;
  year10?: number | string;
};

type FmpEconomicCalendar = {
  date?: string;
  country?: string;
  event?: string;
  impact?: string;
  actual?: string | number;
  previous?: string | number;
  consensus?: string | number;
};

const macroSeriesDefinitions = [
  { symbol: "^GSPC", historySymbol: "^GSPC", name: "S&P 500" },
  { symbol: "^NDX", historySymbol: "^NDX", name: "Nasdaq 100" },
  { symbol: "^RUT", historySymbol: "^RUT", name: "Russell 2000" },
  { symbol: "^VIX", historySymbol: "^VIX", name: "VIX" },
  { symbol: "DX-Y.NYB", historySymbol: "DX-Y.NYB", name: "DXY" },
  { symbol: "CL=F", historySymbol: "CL=F", name: "WTI" },
  { symbol: "GC=F", historySymbol: "GC=F", name: "Gold" }
] as const;

const positiveNewsTerms = ["beat", "raised", "record", "growth", "demand", "contract", "wins", "backlog", "expands", "strong"];
const negativeNewsTerms = ["miss", "cut", "probe", "delay", "lawsuit", "downgrade", "weak", "fall", "dilution", "risk"];

function logLiveWarning(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[live-provider:${scope}] ${message}`);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.replaceAll("%", "").replaceAll(",", "").trim();
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toIsoDate(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizePercent(value: unknown): number {
  return toNumber(value) ?? 0;
}

function normalizeSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function extractHistorical(response: FmpHistoricalResponse): FmpHistoricalPoint[] {
  if (Array.isArray(response)) {
    return response;
  }

  return response.historical ?? [];
}

function toPriceHistory(points: FmpHistoricalPoint[]) {
  return points
    .filter((point) => point.date && toNumber(point.close) !== null)
    .map((point) => ({
      date: toIsoDate(point.date) ?? new Date().toISOString(),
      close: toNumber(point.close) ?? 0,
      volume: Math.max(0, toNumber(point.volume) ?? 0)
    }))
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
}

function computePctChange(current: number, base: number) {
  if (!base) {
    return 0;
  }

  return ((current - base) / base) * 100;
}

function deriveBasePriceFromPct(currentPrice: number, changePct: number) {
  const ratio = 1 + changePct / 100;
  if (!Number.isFinite(ratio) || ratio === 0) {
    return currentPrice;
  }

  return currentPrice / ratio;
}

function buildFallbackPriceHistory(
  currentPrice: number,
  volume: number,
  avgVolume: number,
  priceChange: FmpPriceChange | null,
  quote: FmpQuote | null
): PricePoint[] {
  const pct1D = toNumber(priceChange?.["1D"]) ?? normalizePercent(quote?.changePercentage ?? quote?.changesPercentage);
  const pct5D = toNumber(priceChange?.["5D"]) ?? pct1D * 2.5;
  const pct1M = toNumber(priceChange?.["1M"]) ?? pct5D * 2.8;
  const pct3M = toNumber(priceChange?.["3M"]) ?? pct1M * 1.8;
  const pct1Y = toNumber(priceChange?.["1Y"]) ?? toNumber(priceChange?.ytd) ?? pct3M * 2.5;

  const anchors = [
    { offset: 252, price: deriveBasePriceFromPct(currentPrice, pct1Y) },
    { offset: 63, price: deriveBasePriceFromPct(currentPrice, pct3M) },
    { offset: 21, price: deriveBasePriceFromPct(currentPrice, pct1M) },
    { offset: 5, price: deriveBasePriceFromPct(currentPrice, pct5D) },
    { offset: 1, price: deriveBasePriceFromPct(currentPrice, pct1D) },
    { offset: 0, price: currentPrice }
  ];

  const baseVolume = Math.max(avgVolume || volume || 1, 1);
  const points: PricePoint[] = [];

  for (let index = 0; index < anchors.length - 1; index += 1) {
    const from = anchors[index];
    const to = anchors[index + 1];
    const span = Math.max(from.offset - to.offset, 1);

    for (let step = 0; step < span; step += 1) {
      const progress = step / span;
      const interpolated = from.price + (to.price - from.price) * progress;
      const dayOffset = -from.offset + step;
      points.push({
        date: getDateOffset(dayOffset),
        close: Number(interpolated.toFixed(2)),
        volume: Math.round(baseVolume * (0.88 + progress * 0.24))
      });
    }
  }

  points.push({
    date: new Date().toISOString(),
    close: Number(currentPrice.toFixed(2)),
    volume: Math.round(Math.max(volume, baseVolume))
  });

  return points.sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
}

function deriveTechnicalsFromQuote(
  quote: FmpQuote | null,
  history: PricePoint[],
  currentPrice: number,
  change5dPct: number,
  change20dPct: number
) {
  const historyTechnicals = deriveTechnicals(history);
  const ma50 = toNumber(quote?.priceAvg50) ?? historyTechnicals.ma50;
  const ma200 = toNumber(quote?.priceAvg200) ?? historyTechnicals.ma200;
  const ma20 = history.length >= 20 ? historyTechnicals.ma20 : Number(((currentPrice + ma50) / 2).toFixed(2));
  const high52w = toNumber(quote?.yearHigh) ?? historyTechnicals.high52w;
  const low52w = toNumber(quote?.yearLow) ?? historyTechnicals.low52w;
  const avgVol = Math.max(toNumber(quote?.avgVolume) ?? average(history.slice(-20).map((point) => point.volume)), 1);
  const currentVol = Math.max(toNumber(quote?.volume) ?? history.at(-1)?.volume ?? avgVol, 1);
  const recentMax = Math.max(...history.slice(-30).map((point) => point.close), currentPrice);

  return {
    ma20,
    ma50,
    ma200,
    high52w,
    low52w,
    relativeStrengthLine: change20dPct - 12.5,
    volumeRatio: currentVol / avgVol,
    atrPct: clamp(Math.abs(change5dPct) * 0.55 + Math.abs(change20dPct) * 0.18, 1.2, 12),
    distanceFromHighPct: high52w > 0 ? ((high52w - currentPrice) / high52w) * 100 : 0,
    pullbackDepthPct: recentMax > 0 ? ((recentMax - currentPrice) / recentMax) * 100 : 0
  };
}

function deriveTechnicals(history: StockSnapshot["priceHistory"]) {
  const closes = history.map((point) => point.close);
  const recentVolumeAverage = average(history.slice(-20).map((point) => point.volume));
  const dailyRanges = closes.slice(1).map((value, index) => Math.abs((value - closes[index]) / closes[index]));
  const last = closes.at(-1) ?? 0;
  const recentMax = Math.max(...closes.slice(-30));
  const high52w = Math.max(...closes);
  const low52w = Math.min(...closes);

  return {
    ma20: movingAverage(closes, 20),
    ma50: movingAverage(closes, 50),
    ma200: movingAverage(closes, 200),
    high52w,
    low52w,
    relativeStrengthLine: computePctChange(last, closes.at(-61) ?? last) - 12.5,
    volumeRatio: recentVolumeAverage > 0 ? (history.at(-1)?.volume ?? recentVolumeAverage) / recentVolumeAverage : 1,
    atrPct: average(dailyRanges.slice(-14)) * 160,
    distanceFromHighPct: high52w > 0 ? ((high52w - last) / high52w) * 100 : 0,
    pullbackDepthPct: recentMax > 0 ? ((recentMax - last) / recentMax) * 100 : 0
  };
}

function inferThemes(profile: Pick<StockProfile, "companyName" | "sector" | "industry" | "description">): string[] {
  const text = `${profile.companyName} ${profile.sector} ${profile.industry} ${profile.description}`.toLowerCase();
  const themes = new Set<string>();

  if (/(ai|artificial intelligence|accelerator|gpu|asic|inference|model)/.test(text)) {
    themes.add("AI");
  }
  if (/(semiconductor|chip|fabless|gpu|asic)/.test(text)) {
    themes.add("Semiconductor");
  }
  if (/(cloud|hyperscaler|software infrastructure|data center)/.test(text)) {
    themes.add("Cloud");
  }
  if (/(power|grid|electrical|fuel cell|generation|utility|transformer|energy infrastructure)/.test(text)) {
    themes.add("Power Infrastructure");
  }
  if (/(nuclear|reactor|uranium|smr)/.test(text)) {
    themes.add("Nuclear");
  }
  if (/(defense|aerospace|missile|military)/.test(text)) {
    themes.add("Defense");
  }
  if (/(cyber|security|identity|endpoint|network security)/.test(text)) {
    themes.add("Cybersecurity");
  }
  if (/(robotics|automation|autonomy|electric vehicle)/.test(text)) {
    themes.add("Robotics");
  }
  if (/(obesity|glp-1|weight loss|diabetes)/.test(text)) {
    themes.add("Obesity Treatment");
  }

  if (themes.size === 0) {
    if (profile.sector === "Technology") {
      themes.add("Cloud");
    } else if (profile.sector === "Utilities" || profile.sector === "Energy") {
      themes.add("Power Infrastructure");
    }
  }

  return Array.from(themes);
}

function scoreNewsText(item: FmpNews) {
  const text = `${item.title ?? ""} ${item.text ?? ""}`.toLowerCase();
  let score = 0;

  positiveNewsTerms.forEach((term) => {
    if (text.includes(term)) {
      score += 0.18;
    }
  });
  negativeNewsTerms.forEach((term) => {
    if (text.includes(term)) {
      score -= 0.18;
    }
  });

  return Math.max(-1, Math.min(1, score));
}

function importanceFromNews(item: FmpNews) {
  const text = `${item.title ?? ""} ${item.text ?? ""}`.toLowerCase();
  const hasCriticalKeyword = /(earnings|guidance|contract|backlog|downgrade|upgrade|cpi|fomc)/.test(text);
  return hasCriticalKeyword ? 0.75 : 0.55;
}

function matchNewsToTicker(item: FmpNews, ticker: string, companyName: string) {
  const haystack = `${item.symbol ?? ""} ${item.title ?? ""} ${item.text ?? ""}`.toLowerCase();
  return haystack.includes(ticker.toLowerCase()) || haystack.includes(companyName.toLowerCase());
}

function mapTickerNews(ticker: string, companyName: string, sector: string, news: FmpNews[]): NewsItem[] {
  return news.slice(0, 3).map((item, index) => ({
    id: `${ticker}-live-news-${index}`,
    title: item.title ?? `${ticker} 최근 뉴스`,
    source: item.site ?? "FMP",
    publishedAt: toIsoDate(item.publishedDate) ?? new Date().toISOString(),
    sentimentScore: scoreNewsText(item),
    importanceScore: importanceFromNews(item),
    tickers: [ticker],
    sector,
    summary: item.text ?? `${companyName} 관련 뉴스 흐름입니다.`
  }));
}

function eventImpactToLevel(raw: string | undefined): EconomicEvent["impact"] {
  const text = (raw ?? "").toLowerCase();
  if (text.includes("high")) {
    return "high";
  }
  if (text.includes("medium")) {
    return "medium";
  }
  return "low";
}

async function fetchSeries(symbol: string) {
  return (await fetchYahooHistory(symbol, "6mo", "1d")).slice(-40);
}

async function buildSeriesSnapshot(symbol: string, name: string): Promise<InstrumentSnapshot> {
  const history = await fetchSeries(symbol);
  if (history.length < 6) {
    throw new Error(`Insufficient history for ${symbol}`);
  }

  const last = history.at(-1)?.close ?? 0;
  const prev = history.at(-2)?.close ?? last;
  const base5 = history.at(-6)?.close ?? last;
  const base20 = history.at(-21)?.close ?? last;
  const trend = last > base20 ? "up" : last < base20 ? "down" : "flat";

  return {
    symbol,
    name,
    value: Number(last.toFixed(2)),
    change1dPct: Number(computePctChange(last, prev).toFixed(2)),
    change5dPct: Number(computePctChange(last, base5).toFixed(2)),
    trend
  };
}

async function fetchTreasurySnapshots(client: FmpClient): Promise<InstrumentSnapshot[]> {
  const rows = await client.request<FmpTreasuryRate[]>("treasury-rates");
  const history = (rows ?? []).slice(0, 10).reverse();
  if (history.length < 6) {
    return [];
  }

  const latest = history.at(-1);
  const prev = history.at(-2);
  const base5 = history.at(-6);
  const year2 = toNumber(latest?.year2) ?? 0;
  const year10 = toNumber(latest?.year10) ?? 0;

  return [
    {
      symbol: "US2Y",
      name: "UST 2Y",
      value: year2,
      change1dPct: year2 - (toNumber(prev?.year2) ?? year2),
      change5dPct: year2 - (toNumber(base5?.year2) ?? year2),
      trend: year2 > (toNumber(base5?.year2) ?? year2) ? "up" : year2 < (toNumber(base5?.year2) ?? year2) ? "down" : "flat"
    },
    {
      symbol: "US10Y",
      name: "UST 10Y",
      value: year10,
      change1dPct: year10 - (toNumber(prev?.year10) ?? year10),
      change5dPct: year10 - (toNumber(base5?.year10) ?? year10),
      trend: year10 > (toNumber(base5?.year10) ?? year10) ? "up" : year10 < (toNumber(base5?.year10) ?? year10) ? "down" : "flat"
    }
  ];
}

export class LiveMarketDataProvider implements MarketDataProvider {
  constructor(private readonly client: FmpClient) {}

  async getMacroSnapshot(): Promise<{
    asOf: string;
    regime: MarketRegime;
    indices: InstrumentSnapshot[];
    macroAssets: InstrumentSnapshot[];
    economicEvents: EconomicEvent[];
  }> {
    const seriesSnapshotResults: Array<InstrumentSnapshot | null> = (
      await Promise.allSettled(macroSeriesDefinitions.map((item) => buildSeriesSnapshot(item.historySymbol, item.name).then((snapshot) => ({ ...snapshot, symbol: item.symbol }))))
    )
      .map((result, index) => {
        if (result.status === "fulfilled") {
          return result.value;
        }

        logLiveWarning(`macro:${macroSeriesDefinitions[index].symbol}`, result.reason);
        return null;
      });
    const seriesSnapshots = seriesSnapshotResults.filter((item): item is InstrumentSnapshot => item !== null);
    const treasurySnapshots = await fetchTreasurySnapshots(this.client).catch((error) => {
      logLiveWarning("macro:treasury-rates", error);
      return [];
    });

    const spyLike = seriesSnapshots.find((item) => item.symbol === "^GSPC");
    const qqqLike = seriesSnapshots.find((item) => item.symbol === "^NDX");
    const iwmLike = seriesSnapshots.find((item) => item.symbol === "^RUT");
    const vix = seriesSnapshots.find((item) => item.symbol === "^VIX");
    const dxy = seriesSnapshots.find((item) => item.symbol === "DX-Y.NYB");

    const riskScore =
      (spyLike?.change5dPct ?? 0) +
      (qqqLike?.change5dPct ?? 0) +
      (iwmLike?.change5dPct ?? 0) -
      ((vix?.value ?? 18) - 18) * 2 -
      ((dxy?.change5dPct ?? 0) > 0 ? 4 : -2);

    const regime: MarketRegime = riskScore >= 8 ? "risk-on" : riskScore <= -4 ? "risk-off" : "neutral";

    return {
      asOf: new Date().toISOString(),
      regime,
      indices: [spyLike, qqqLike, iwmLike].filter((item): item is InstrumentSnapshot => Boolean(item)),
      macroAssets: [...treasurySnapshots, vix, dxy, seriesSnapshots.find((item) => item.symbol === "CL=F"), seriesSnapshots.find((item) => item.symbol === "GC=F")].filter(
        (item): item is InstrumentSnapshot => Boolean(item)
      ),
      economicEvents: await new LiveCalendarProvider(this.client).getEconomicEvents().catch((error) => {
        logLiveWarning("macro:economic-calendar", error);
        return [];
      })
    };
  }

  async getSectorPerformance() {
    return [];
  }

  async getThemeSnapshots() {
    return [];
  }

  async getStockSnapshots(tickers: string[]): Promise<StockSnapshot[]> {
    const quotes = await this.client.request<FmpQuote[]>("batch-quote", { symbols: tickers.join(",") }).catch((error) => {
      logLiveWarning("stocks:batch-quote", error);
      return [];
    });
    const quoteMap = new Map((quotes ?? []).map((item) => [item.symbol?.toUpperCase() ?? "", item]));

    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - 2);
    const toDate = new Date(today);
    toDate.setDate(today.getDate() + 120);

    const [allNews, earningsCalendar] = await Promise.all([
      this.client.request<FmpNews[]>("news/stock", { symbols: tickers.join(","), limit: Math.max(60, tickers.length * 4) }).catch((error) => {
        logLiveWarning("stocks:news", error);
        return [];
      }),
      this.client
        .request<FmpEarningsCalendar[]>("earnings-calendar", {
          from: fromDate.toISOString().slice(0, 10),
          to: toDate.toISOString().slice(0, 10)
        })
        .catch((error) => {
          logLiveWarning("stocks:earnings-calendar", error);
          return [];
        })
    ]);

    const settledStocks = await Promise.allSettled(
      tickers.map(async (ticker) => {
        const upperTicker = ticker.toUpperCase();
        const quote = quoteMap.get(upperTicker) ?? null;
        const [profileResponse, historyRows, fallbackQuoteResponse, priceChangeResponse, earningsSurprises] = await Promise.all([
          this.client.request<FmpProfile[] | FmpProfile>("profile", { symbol: upperTicker }).catch((error) => {
            logLiveWarning(`stocks:${upperTicker}:profile`, error);
            return null;
          }),
          fetchYahooHistory(upperTicker, "1y", "1d").catch((error) => {
            logLiveWarning(`stocks:${upperTicker}:history`, error);
            return [];
          }),
          quote
            ? Promise.resolve(null)
            : this.client.request<FmpQuote[] | FmpQuote>("quote", { symbol: upperTicker }).catch((error) => {
                logLiveWarning(`stocks:${upperTicker}:quote`, error);
                return null;
              }),
          this.client.request<FmpPriceChange[] | FmpPriceChange>("stock-price-change", { symbol: upperTicker }).catch((error) => {
            logLiveWarning(`stocks:${upperTicker}:price-change`, error);
            return null;
          }),
          this.client.request<FmpEarningsSurprise[]>("earnings-surprises", { symbol: upperTicker }).catch((error) => {
            logLiveWarning(`stocks:${upperTicker}:earnings-surprises`, error);
            return [];
          })
        ]);

        const liveQuote = quote ?? normalizeSingle(fallbackQuoteResponse);
        const profile = normalizeSingle(profileResponse);
        const priceChange = normalizeSingle(priceChangeResponse);
        let history = historyRows.slice(-260);
        const currentPrice = toNumber(liveQuote?.price) ?? toNumber(profile?.price) ?? history.at(-1)?.close ?? 0;

        if (history.length < 60 && currentPrice > 0) {
          history = buildFallbackPriceHistory(
            currentPrice,
            toNumber(liveQuote?.volume) ?? 0,
            toNumber(liveQuote?.avgVolume) ?? 0,
            priceChange,
            liveQuote
          ).slice(-260);
        }

        if (!profile || currentPrice <= 0 || history.length < 20) {
          throw new Error(`Insufficient live data for ${upperTicker}`);
        }

        const latestHistoryPrice = history.at(-1)?.close ?? currentPrice;
        if (latestHistoryPrice !== currentPrice) {
          history[history.length - 1] = {
            ...history[history.length - 1],
            close: currentPrice,
            volume: Math.max(history.at(-1)?.volume ?? 0, toNumber(liveQuote?.volume) ?? history.at(-1)?.volume ?? 0)
          };
        }

        const base5 = history.at(-6)?.close ?? currentPrice;
        const base20 = history.at(-21)?.close ?? currentPrice;
        const base60 = history.at(-61)?.close ?? currentPrice;
        const change1dPct =
          normalizePercent(liveQuote?.changePercentage ?? liveQuote?.changesPercentage) ||
          computePctChange(currentPrice, toNumber(liveQuote?.previousClose) ?? history.at(-2)?.close ?? currentPrice);
        const change5dPct = toNumber(priceChange?.["5D"]) ?? computePctChange(currentPrice, base5);
        const change20dPct = toNumber(priceChange?.["1M"]) ?? computePctChange(currentPrice, base20);
        const change60dPct = toNumber(priceChange?.["3M"]) ?? computePctChange(currentPrice, base60);
        const technicals = deriveTechnicalsFromQuote(liveQuote, history, currentPrice, change5dPct, change20dPct);
        const recentNews = mapTickerNews(
          upperTicker,
          profile.companyName ?? upperTicker,
          profile.sector ?? "Unknown",
          (allNews ?? []).filter((item) => matchNewsToTicker(item, upperTicker, profile.companyName ?? upperTicker))
        );
        const surprise = (earningsSurprises ?? []).find((item) => toIsoDate(item.date));
        const nextEarnings = (earningsCalendar ?? [])
          .filter((item) => item.symbol?.toUpperCase() === upperTicker)
          .map((item) => toIsoDate(item.date))
          .filter((value): value is string => Boolean(value))
          .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0] ?? null;

        const liveProfile: StockProfile = {
          ticker: upperTicker,
          companyName: profile.companyName ?? upperTicker,
          sector: profile.sector ?? "Unknown",
          industry: profile.industry ?? "Unknown",
          themes: inferThemes({
            companyName: profile.companyName ?? upperTicker,
            sector: profile.sector ?? "Unknown",
            industry: profile.industry ?? "Unknown",
            description: profile.description ?? ""
          }),
          description: getLocalizedStockDescription(upperTicker, profile.description ?? `${upperTicker} 실시간 프로필입니다.`)
        };

        const earningsEventNote = getLocalizedStockEventNote(
          upperTicker,
          nextEarnings ? `다음 실적일은 ${nextEarnings.slice(0, 10)} 기준으로 확인됩니다.` : "다음 실적일은 아직 공급 데이터에서 확인되지 않았습니다."
        );

        return {
          profile: liveProfile,
          quote: {
            ticker: upperTicker,
            price: currentPrice,
            change1dPct,
            change5dPct,
            change20dPct,
            change60dPct,
            volume: toNumber(liveQuote?.volume) ?? history.at(-1)?.volume ?? 0
          },
          fundamentals: {
            marketCapBn: (toNumber(liveQuote?.marketCap) ?? toNumber(profile.mktCap) ?? 0) / 1_000_000_000,
            averageDollarVolumeM: ((toNumber(liveQuote?.avgVolume) ?? average(history.slice(-20).map((point) => point.volume))) * currentPrice) / 1_000_000,
            beta: toNumber(profile.beta) ?? 1,
            pe: toNumber(liveQuote?.pe),
            priceToSales: null
          },
          technicals,
          earnings: {
            lastReportDate: toIsoDate(surprise?.date) ?? getDateOffset(-45),
            nextEarningsDate: nextEarnings,
            revenueGrowthPct: 0,
            epsSurprisePct:
              toNumber(surprise?.estimatedEarning) && toNumber(surprise?.actualEarningResult)
                ? computePctChange(toNumber(surprise?.actualEarningResult) ?? 0, toNumber(surprise?.estimatedEarning) ?? 1)
                : 0,
            guidance: "inline",
            epsRevisionScore: recentNews.length > 0 ? clamp(50 + recentNews.reduce((sum, item) => sum + item.sentimentScore, 0) * 20) : 50,
            summary:
              nextEarnings ? `다음 실적일 ${nextEarnings.slice(0, 10)} 기준, 최근 뉴스와 가격 반응을 함께 체크하세요.` : "다음 실적일 미확인, 가격 구조와 뉴스 반응 위주로 점검하세요."
          },
          priceHistory: history,
          recentNews,
          eventCalendar: [
            ...(nextEarnings
              ? [
                  {
                    id: `${upperTicker}-earnings`,
                    title: "다음 실적 발표",
                    date: nextEarnings,
                    category: "earnings" as const,
                    note: earningsEventNote
                  }
                ]
              : []),
            {
              id: `${upperTicker}-check`,
              title: "다음 체크포인트",
              date: getDateOffset(3),
              category: "product",
              note: earningsEventNote
            }
          ]
        } satisfies StockSnapshot;
      })
    );

    const snapshots: Array<StockSnapshot | null> = settledStocks
      .map((result, index) => {
        if (result.status === "fulfilled") {
          return result.value;
        }

        logLiveWarning(`stocks:${tickers[index].toUpperCase()}`, result.reason);
        return null;
      });

    return snapshots.filter((item): item is StockSnapshot => item !== null);
  }
}

export class LiveNewsProvider implements NewsProvider {
  constructor(private readonly client: FmpClient) {}

  async getMarketNews() {
    const news = await this.client.request<FmpNews[]>("news/stock-latest", { limit: 12 }).catch((error) => {
      logLiveWarning("news:market", error);
      return [];
    });
    return (news ?? []).slice(0, 12).map((item, index) => ({
      id: `market-live-${index}`,
      title: item.title ?? "실시간 시장 뉴스",
      source: item.site ?? "FMP",
      publishedAt: toIsoDate(item.publishedDate) ?? new Date().toISOString(),
      sentimentScore: scoreNewsText(item),
      importanceScore: importanceFromNews(item),
      tickers: item.symbol ? [item.symbol.toUpperCase()] : [],
      sector: "Cross-Market",
      summary: item.text ?? "시장 전반 뉴스 흐름입니다."
    }));
  }

  async getTickerNews(tickers: string[]) {
    const news = await this.client.request<FmpNews[]>("news/stock", { symbols: tickers.join(","), limit: Math.max(60, tickers.length * 4) }).catch((error) => {
      logLiveWarning("news:ticker", error);
      return [];
    });
    const result: Record<string, NewsItem[]> = {};
    tickers.forEach((ticker) => {
      const upperTicker = ticker.toUpperCase();
      result[upperTicker] = mapTickerNews(upperTicker, upperTicker, "Cross-Market", (news ?? []).filter((item) => matchNewsToTicker(item, upperTicker, upperTicker)));
    });
    return result;
  }
}

export class LiveFundamentalsProvider implements FundamentalsProvider {
  constructor(private readonly client: FmpClient) {}

  async getStockProfiles(tickers: string[]): Promise<Record<string, StockProfile>> {
    const entries = await Promise.all(
      tickers.map(async (ticker) => {
        const profileRows = await this.client.request<FmpProfile[]>("profile", { symbol: ticker.toUpperCase() }).catch((error) => {
          logLiveWarning(`fundamentals:${ticker.toUpperCase()}:profile`, error);
          return [];
        });
        const profile = profileRows?.[0];
        if (!profile) {
          return null;
        }

        const stockProfile: StockProfile = {
          ticker: ticker.toUpperCase(),
          companyName: profile.companyName ?? ticker.toUpperCase(),
          sector: profile.sector ?? "Unknown",
          industry: profile.industry ?? "Unknown",
          themes: inferThemes({
            companyName: profile.companyName ?? ticker.toUpperCase(),
            sector: profile.sector ?? "Unknown",
            industry: profile.industry ?? "Unknown",
            description: profile.description ?? ""
          }),
          description: getLocalizedStockDescription(ticker.toUpperCase(), profile.description ?? `${ticker.toUpperCase()} 실시간 프로필입니다.`)
        };

        return [ticker.toUpperCase(), stockProfile] as const;
      })
    );

    return Object.fromEntries(entries.filter((entry): entry is readonly [string, StockProfile] => Boolean(entry)));
  }

  async getUpcomingEvents(tickers: string[]): Promise<Record<string, StockEvent[]>> {
    const from = new Date().toISOString().slice(0, 10);
    const to = new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10);
    const calendar = await this.client.request<FmpEarningsCalendar[]>("earnings-calendar", { from, to }).catch((error) => {
      logLiveWarning("fundamentals:earnings-calendar", error);
      return [];
    });
    const result: Record<string, StockEvent[]> = {};

    tickers.forEach((ticker) => {
      const next = (calendar ?? [])
        .filter((item) => item.symbol?.toUpperCase() === ticker.toUpperCase())
        .map((item) => toIsoDate(item.date))
        .filter((value): value is string => Boolean(value))
        .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0];

      result[ticker.toUpperCase()] = next
        ? [
            {
              id: `${ticker.toUpperCase()}-earnings`,
              title: "다음 실적 발표",
              date: next,
              category: "earnings",
              note: `${ticker.toUpperCase()} 실적 발표 일정입니다.`
            }
          ]
        : [];
    });

    return result;
  }
}

export class LiveCalendarProvider implements CalendarProvider {
  constructor(private readonly client: FmpClient) {}

  async getEconomicEvents() {
    const from = new Date().toISOString().slice(0, 10);
    const to = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const rows = await this.client.request<FmpEconomicCalendar[]>("economic-calendar", { from, to }).catch((error) => {
      logLiveWarning("calendar:economic-calendar", error);
      return [];
    });

    return (rows ?? [])
      .filter((item) => (item.country ?? "").toUpperCase() === "US")
      .slice(0, 8)
      .map((item, index) => ({
        id: `econ-${index}`,
        title: item.event ?? "미국 경제 일정",
        date: toIsoDate(item.date) ?? new Date().toISOString(),
        impact: eventImpactToLevel(item.impact),
        note: `실제 ${item.actual ?? "-"}, 예상 ${item.consensus ?? "-"}, 이전 ${item.previous ?? "-"}`
      } satisfies EconomicEvent));
  }
}

export class OpenAICompatibleProvider extends TemplateAIProvider implements AIProvider {
  private readonly apiKey = process.env.OPENAI_API_KEY ?? "";
  private readonly model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  private readonly baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

  private get configured() {
    return Boolean(this.apiKey);
  }

  private async completion(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "당신은 한국 거주 투자자를 위한 미국주식 리서치 보조자입니다. 매수 추천처럼 말하지 말고, 감시 우선순위와 확인 포인트를 짧고 명확하게 설명하세요."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI-compatible request failed: ${response.status}`);
    }

    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  }

  async summarizeMarket(input: Parameters<AIProvider["summarizeMarket"]>[0]) {
    if (!this.configured) {
      return super.summarizeMarket(input);
    }

    try {
      return await this.completion(`한국 거주 스윙 투자자 기준으로 현재 미국 시장 레짐을 3문장으로 요약해 주세요. 레짐: ${input.market.regime}. 상위 섹터: ${input.sectors.slice(0, 4).map((item) => `${item.sector} ${item.score}`).join(", ")}. 주요 뉴스: ${input.news.slice(0, 4).map((item) => item.title).join(" | ")}`);
    } catch {
      return super.summarizeMarket(input);
    }
  }

  async summarizeThemes(input: Parameters<AIProvider["summarizeThemes"]>[0]) {
    if (!this.configured) {
      return super.summarizeThemes(input);
    }

    try {
      return await this.completion(`현재 강한 미국주식 테마를 3문장으로 요약해 주세요. 테마: ${input.themes.slice(0, 5).map((item) => `${item.name} ${item.score}`).join(", ")}. 관련 뉴스: ${input.news.slice(0, 3).map((item) => item.title).join(" | ")}`);
    } catch {
      return super.summarizeThemes(input);
    }
  }

  async summarizeStock(input: { candidate: CandidateStock }): Promise<Pick<StockNarrative, "bullishFactors" | "bearishFactors" | "whatToWatchNext">> {
    if (!this.configured) {
      return super.summarizeStock(input);
    }

    try {
      const response = await this.completion(
        `${input.candidate.profile.ticker}에 대해 긍정 요인 1개, 부정 요인 1개, 다음 체크포인트 1개를 짧게 써 주세요. 형식은 '긍정 || 부정 || 체크포인트'로 주세요. 점수 ${input.candidate.score.finalScore.toFixed(1)}, 라벨 ${input.candidate.label}, 테마 ${input.candidate.profile.themes.join(", ")}`
      );
      const [bullish, bearish, next] = response.split("||").map((item) => item.trim());
      return {
        bullishFactors: [bullish || `${input.candidate.profile.ticker}는 현재 테마 강도에서 완전히 이탈하지 않았습니다.`],
        bearishFactors: [bearish || "단기 이벤트와 변동성 관리가 중요합니다."],
        whatToWatchNext: [next || "다음 유효 가격대와 거래량 회복 여부를 확인하세요."]
      };
    } catch {
      return super.summarizeStock(input);
    }
  }
}

