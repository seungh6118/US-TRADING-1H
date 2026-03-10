import {
  CalendarProvider,
  EconomicEvent,
  FundamentalsProvider,
  InstrumentSnapshot,
  MarketDataProvider,
  MarketRegime,
  NewsItem,
  NewsProvider,
  PricePoint,
  SectorPerformance,
  StockEvent,
  StockProfile,
  StockSnapshot,
  ThemeSnapshot
} from "@/lib/types";
import { getLocalizedStockDescription } from "@/lib/localization";
import { average, movingAverage } from "@/lib/utils";
import { fetchYahooHistory } from "@/providers/live/yahoo-chart";
import { getAllMockStockSnapshots } from "@/providers/mock/mock-data";

type FreeMetadata = {
  ticker: string;
  companyName: string;
  sector: string;
  industry: string;
  themes: string[];
  marketCapBn: number;
  averageDollarVolumeM: number;
  beta: number;
  pe: number | null;
};

const macroDefinitions = [
  { symbol: "^GSPC", name: "S&P 500" },
  { symbol: "^NDX", name: "Nasdaq 100" },
  { symbol: "^RUT", name: "Russell 2000" },
  { symbol: "^VIX", name: "VIX" },
  { symbol: "DX-Y.NYB", name: "DXY" },
  { symbol: "CL=F", name: "WTI" },
  { symbol: "GC=F", name: "Gold" },
  { symbol: "^TNX", name: "UST 10Y" }
] as const;

const metadataOverrides: Record<string, FreeMetadata> = {
  ANET: {
    ticker: "ANET",
    companyName: "Arista Networks",
    sector: "Technology",
    industry: "Cloud Networking",
    themes: ["AI", "Cloud"],
    marketCapBn: 105,
    averageDollarVolumeM: 1300,
    beta: 1.15,
    pe: 42
  },
  NOC: {
    ticker: "NOC",
    companyName: "Northrop Grumman",
    sector: "Defense",
    industry: "Aerospace & Defense",
    themes: ["Defense"],
    marketCapBn: 70,
    averageDollarVolumeM: 500,
    beta: 0.8,
    pe: 18
  },
  BE: {
    ticker: "BE",
    companyName: "Bloom Energy",
    sector: "Power Infrastructure",
    industry: "Fuel Cells & Distributed Power",
    themes: ["Power Infrastructure", "AI"],
    marketCapBn: 7,
    averageDollarVolumeM: 450,
    beta: 1.9,
    pe: null
  },
  PLTR: {
    ticker: "PLTR",
    companyName: "Palantir",
    sector: "Technology",
    industry: "AI Software & Government Analytics",
    themes: ["AI"],
    marketCapBn: 340,
    averageDollarVolumeM: 3500,
    beta: 1.7,
    pe: null
  },
  VST: {
    ticker: "VST",
    companyName: "Vistra",
    sector: "Power Infrastructure",
    industry: "Power Generation",
    themes: ["Power Infrastructure"],
    marketCapBn: 45,
    averageDollarVolumeM: 1100,
    beta: 0.9,
    pe: 19
  },
  NRG: {
    ticker: "NRG",
    companyName: "NRG Energy",
    sector: "Power Infrastructure",
    industry: "Independent Power Producer",
    themes: ["Power Infrastructure"],
    marketCapBn: 20,
    averageDollarVolumeM: 600,
    beta: 1.1,
    pe: 18
  },
  TLN: {
    ticker: "TLN",
    companyName: "Talen Energy",
    sector: "Power Infrastructure",
    industry: "Power Generation",
    themes: ["Power Infrastructure", "Nuclear"],
    marketCapBn: 11,
    averageDollarVolumeM: 450,
    beta: 1.35,
    pe: 24
  },
  BWXT: {
    ticker: "BWXT",
    companyName: "BWX Technologies",
    sector: "Utilities & Nuclear",
    industry: "Nuclear Components",
    themes: ["Nuclear", "Power Infrastructure"],
    marketCapBn: 10,
    averageDollarVolumeM: 250,
    beta: 0.7,
    pe: 31
  }
};

const baseMockMap = new Map(getAllMockStockSnapshots().map((stock) => [stock.profile.ticker, stock]));

function computePctChange(current: number, base: number) {
  if (!base) {
    return 0;
  }

  return ((current - base) / base) * 100;
}

function buildInstrumentSnapshot(symbol: string, name: string, history: PricePoint[]): InstrumentSnapshot {
  const last = history.at(-1)?.close ?? 0;
  const prev = history.at(-2)?.close ?? last;
  const base5 = history.at(-6)?.close ?? last;
  const trend = last > (history.at(-21)?.close ?? last) ? "up" : last < (history.at(-21)?.close ?? last) ? "down" : "flat";

  return {
    symbol,
    name,
    value: Number(last.toFixed(2)),
    change1dPct: Number(computePctChange(last, prev).toFixed(2)),
    change5dPct: Number(computePctChange(last, base5).toFixed(2)),
    trend
  };
}

function deriveTechnicals(history: PricePoint[], price: number) {
  const closes = history.map((point) => point.close);
  const last = price || closes.at(-1) || 0;
  const recentVolumeAverage = average(history.slice(-20).map((point) => point.volume));
  const dailyRanges = closes.slice(1).map((value, index) => Math.abs((value - closes[index]) / Math.max(closes[index], 1)));
  const recentMax = Math.max(...closes.slice(-30), last);
  const high52w = Math.max(...closes, last);
  const low52w = Math.min(...closes, last);

  return {
    ma20: movingAverage(closes, Math.min(20, closes.length)),
    ma50: movingAverage(closes, Math.min(50, closes.length)),
    ma200: movingAverage(closes, Math.min(200, closes.length)),
    high52w,
    low52w,
    relativeStrengthLine: computePctChange(last, closes.at(-61) ?? last) - 12.5,
    volumeRatio: recentVolumeAverage > 0 ? (history.at(-1)?.volume ?? recentVolumeAverage) / recentVolumeAverage : 1,
    atrPct: average(dailyRanges.slice(-14)) * 160,
    distanceFromHighPct: high52w > 0 ? ((high52w - last) / high52w) * 100 : 0,
    pullbackDepthPct: recentMax > 0 ? ((recentMax - last) / recentMax) * 100 : 0
  };
}

function buildMetadata(ticker: string): FreeMetadata {
  const normalizedTicker = ticker.toUpperCase();
  const override = metadataOverrides[normalizedTicker];
  if (override) {
    return override;
  }

  const base = baseMockMap.get(normalizedTicker);
  if (base) {
    return {
      ticker: normalizedTicker,
      companyName: base.profile.companyName,
      sector: base.profile.sector,
      industry: base.profile.industry,
      themes: base.profile.themes,
      marketCapBn: base.fundamentals.marketCapBn,
      averageDollarVolumeM: base.fundamentals.averageDollarVolumeM,
      beta: base.fundamentals.beta,
      pe: base.fundamentals.pe
    };
  }

  return {
    ticker: normalizedTicker,
    companyName: normalizedTicker,
    sector: "Technology",
    industry: "Large Cap",
    themes: ["AI"],
    marketCapBn: 25,
    averageDollarVolumeM: 500,
    beta: 1,
    pe: null
  };
}

function buildLimitedSummary(ticker: string) {
  return `${ticker}는 Yahoo 무료 가격 데이터를 바탕으로 계산하며, 뉴스와 실적 해석은 제한적으로 반영됩니다.`;
}

export class YahooFreeMarketDataProvider implements MarketDataProvider {
  async getMacroSnapshot(): Promise<Omit<{ asOf: string; regime: MarketRegime; indices: InstrumentSnapshot[]; macroAssets: InstrumentSnapshot[]; economicEvents: EconomicEvent[]; aiSummary: string }, "aiSummary">> {
    const histories = await Promise.allSettled(
      macroDefinitions.map(async (item) => ({ item, history: await fetchYahooHistory(item.symbol, "6mo", "1d") }))
    );

    const snapshots = histories
      .map((result) => (result.status === "fulfilled" && result.value.history.length >= 6 ? buildInstrumentSnapshot(result.value.item.symbol, result.value.item.name, result.value.history) : null))
      .filter((item): item is InstrumentSnapshot => item !== null);

    const spy = snapshots.find((item) => item.symbol === "^GSPC");
    const ndx = snapshots.find((item) => item.symbol === "^NDX");
    const rut = snapshots.find((item) => item.symbol === "^RUT");
    const vix = snapshots.find((item) => item.symbol === "^VIX");
    const dxy = snapshots.find((item) => item.symbol === "DX-Y.NYB");

    const riskScore =
      (spy?.change5dPct ?? 0) +
      (ndx?.change5dPct ?? 0) +
      (rut?.change5dPct ?? 0) -
      ((vix?.value ?? 18) - 18) * 2 -
      ((dxy?.change5dPct ?? 0) > 0 ? 4 : -2);

    const regime: MarketRegime = riskScore >= 8 ? "risk-on" : riskScore <= -4 ? "risk-off" : "neutral";

    return {
      asOf: new Date().toISOString(),
      regime,
      indices: [spy, ndx, rut].filter((item): item is InstrumentSnapshot => item !== undefined),
      macroAssets: snapshots.filter((item) => !["^GSPC", "^NDX", "^RUT"].includes(item.symbol)),
      economicEvents: []
    };
  }

  async getSectorPerformance(): Promise<SectorPerformance[]> {
    return [];
  }

  async getThemeSnapshots(): Promise<ThemeSnapshot[]> {
    return [];
  }

  async getStockSnapshots(tickers: string[]): Promise<StockSnapshot[]> {
    const results = await Promise.allSettled(
      tickers.map(async (ticker) => {
        const meta = buildMetadata(ticker);
        const history = await fetchYahooHistory(meta.ticker, "1y", "1d");
        if (history.length < 20) {
          throw new Error(`Insufficient Yahoo history for ${meta.ticker}`);
        }

        const price = history.at(-1)?.close ?? 0;
        const base5 = history.at(-6)?.close ?? price;
        const base20 = history.at(-21)?.close ?? price;
        const base60 = history.at(-61)?.close ?? price;
        const technicals = deriveTechnicals(history, price);

        return {
          profile: {
            ticker: meta.ticker,
            companyName: meta.companyName,
            sector: meta.sector,
            industry: meta.industry,
            themes: meta.themes,
            description: getLocalizedStockDescription(meta.ticker, buildLimitedSummary(meta.ticker))
          },
          quote: {
            ticker: meta.ticker,
            price,
            change1dPct: computePctChange(price, history.at(-2)?.close ?? price),
            change5dPct: computePctChange(price, base5),
            change20dPct: computePctChange(price, base20),
            change60dPct: computePctChange(price, base60),
            volume: history.at(-1)?.volume ?? 0
          },
          fundamentals: {
            marketCapBn: meta.marketCapBn,
            averageDollarVolumeM: ((average(history.slice(-20).map((point) => point.volume)) || 0) * price) / 1_000_000,
            beta: meta.beta,
            pe: meta.pe,
            priceToSales: null
          },
          technicals,
          earnings: {
            lastReportDate: new Date(Date.now() - 45 * 86400000).toISOString(),
            nextEarningsDate: null,
            revenueGrowthPct: 0,
            epsSurprisePct: 0,
            guidance: "inline",
            epsRevisionScore: 50,
            summary: "Yahoo 무료 모드에서는 실적과 EPS 수정치 데이터가 제한적입니다."
          },
          priceHistory: history,
          recentNews: [],
          eventCalendar: []
        } satisfies StockSnapshot;
      })
    );

    const snapshots: Array<StockSnapshot | null> = results.map((result) => (result.status === "fulfilled" ? result.value : null));
    return snapshots.filter((item): item is StockSnapshot => item !== null);
  }
}

export class YahooFreeNewsProvider implements NewsProvider {
  async getMarketNews(): Promise<NewsItem[]> {
    return [];
  }

  async getTickerNews(tickers: string[]): Promise<Record<string, NewsItem[]>> {
    return Object.fromEntries(tickers.map((ticker) => [ticker.toUpperCase(), []]));
  }
}

export class YahooFreeFundamentalsProvider implements FundamentalsProvider {
  async getStockProfiles(tickers: string[]): Promise<Record<string, StockProfile>> {
    return Object.fromEntries(
      tickers.map((ticker) => {
        const meta = buildMetadata(ticker);
        return [
          meta.ticker,
          {
            ticker: meta.ticker,
            companyName: meta.companyName,
            sector: meta.sector,
            industry: meta.industry,
            themes: meta.themes,
            description: getLocalizedStockDescription(meta.ticker, buildLimitedSummary(meta.ticker))
          }
        ];
      })
    );
  }

  async getUpcomingEvents(tickers: string[]): Promise<Record<string, StockEvent[]>> {
    return Object.fromEntries(tickers.map((ticker) => [ticker.toUpperCase(), []]));
  }
}

export class YahooFreeCalendarProvider implements CalendarProvider {
  async getEconomicEvents(): Promise<EconomicEvent[]> {
    return [];
  }
}
