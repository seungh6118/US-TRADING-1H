import {
  AIProvider,
  CalendarProvider,
  CandidateStock,
  FundamentalsProvider,
  MarketDataProvider,
  NewsProvider,
  StockEvent,
  StockNarrative,
  StockProfile,
  StockSnapshot
} from "@/lib/types";
import { average, getDateOffset, movingAverage } from "@/lib/utils";
import { FmpClient } from "@/providers/live/fmp-client";
import {
  MockCalendarProvider,
  MockFundamentalsProvider,
  MockMarketDataProvider,
  MockNewsProvider,
  TemplateAIProvider
} from "@/providers/mock/mock-providers";

type FmpQuote = {
  symbol: string;
  price: number;
  changesPercentage?: number;
  change?: number;
  volume?: number;
  marketCap?: number;
  avgVolume?: number;
  pe?: number;
};

type FmpProfile = {
  symbol: string;
  companyName?: string;
  sector?: string;
  industry?: string;
  description?: string;
  beta?: number;
  price?: number;
  mktCap?: number;
};

type FmpHistoricalResponse = {
  historical?: Array<{ date: string; close: number; volume: number }>;
};

type FmpNews = {
  title?: string;
  site?: string;
  publishedDate?: string;
  text?: string;
};

type FmpEarningsSurprise = {
  date?: string;
  estimatedEarning?: number;
  actualEarningResult?: number;
};

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
    relativeStrengthLine: ((last - (closes.at(-61) ?? last)) / (closes.at(-61) ?? last)) * 100 - 12.5,
    volumeRatio: (history.at(-1)?.volume ?? recentVolumeAverage) / recentVolumeAverage,
    atrPct: average(dailyRanges.slice(-14)) * 160,
    distanceFromHighPct: ((high52w - last) / high52w) * 100,
    pullbackDepthPct: ((recentMax - last) / recentMax) * 100
  };
}

function mapNews(ticker: string, sector: string, news: FmpNews[]) {
  return news.slice(0, 3).map((item, index) => ({
    id: `${ticker}-live-news-${index}`,
    title: item.title ?? `${ticker} recent headline`,
    source: item.site ?? "FMP",
    publishedAt: item.publishedDate ?? new Date().toISOString(),
    sentimentScore: 0.15,
    importanceScore: 0.55,
    tickers: [ticker],
    sector,
    summary: item.text ?? `${ticker} headline imported from live provider.`
  }));
}

export class LiveMarketDataProvider implements MarketDataProvider {
  constructor(
    private readonly client: FmpClient,
    private readonly fallback = new MockMarketDataProvider()
  ) {}

  async getMacroSnapshot() {
    if (!this.client.configured) {
      return this.fallback.getMacroSnapshot();
    }

    try {
      const proxies = await this.client.request<FmpQuote[]>("quote/SPY,QQQ,IWM,VIXY,SHY,IEF,UUP,USO,GLD");
      const map = new Map((proxies ?? []).map((item) => [item.symbol, item]));
      return {
        asOf: new Date().toISOString(),
        regime: "risk-on" as const,
        indices: [
          { symbol: "SPY", name: "S&P 500", value: map.get("SPY")?.price ?? 0, change1dPct: map.get("SPY")?.changesPercentage ?? 0, change5dPct: 1.4, trend: "up" as const },
          { symbol: "QQQ", name: "Nasdaq 100", value: map.get("QQQ")?.price ?? 0, change1dPct: map.get("QQQ")?.changesPercentage ?? 0, change5dPct: 2.4, trend: "up" as const },
          { symbol: "IWM", name: "Russell 2000", value: map.get("IWM")?.price ?? 0, change1dPct: map.get("IWM")?.changesPercentage ?? 0, change5dPct: 0.6, trend: "flat" as const }
        ],
        macroAssets: [
          { symbol: "VIXY", name: "VIX proxy", value: map.get("VIXY")?.price ?? 0, change1dPct: map.get("VIXY")?.changesPercentage ?? 0, change5dPct: -3.2, trend: "down" as const },
          { symbol: "SHY", name: "UST 2Y proxy", value: map.get("SHY")?.price ?? 0, change1dPct: map.get("SHY")?.changesPercentage ?? 0, change5dPct: 0.4, trend: "flat" as const },
          { symbol: "IEF", name: "UST 10Y proxy", value: map.get("IEF")?.price ?? 0, change1dPct: map.get("IEF")?.changesPercentage ?? 0, change5dPct: 0.7, trend: "flat" as const },
          { symbol: "UUP", name: "DXY proxy", value: map.get("UUP")?.price ?? 0, change1dPct: map.get("UUP")?.changesPercentage ?? 0, change5dPct: -0.5, trend: "down" as const },
          { symbol: "USO", name: "WTI proxy", value: map.get("USO")?.price ?? 0, change1dPct: map.get("USO")?.changesPercentage ?? 0, change5dPct: 1.1, trend: "up" as const },
          { symbol: "GLD", name: "Gold proxy", value: map.get("GLD")?.price ?? 0, change1dPct: map.get("GLD")?.changesPercentage ?? 0, change5dPct: 0.9, trend: "up" as const }
        ],
        economicEvents: await new MockCalendarProvider().getEconomicEvents()
      };
    } catch {
      return this.fallback.getMacroSnapshot();
    }
  }

  async getSectorPerformance() {
    return this.fallback.getSectorPerformance();
  }

  async getThemeSnapshots() {
    return this.fallback.getThemeSnapshots();
  }

  async getStockSnapshots(tickers: string[]) {
    if (!this.client.configured) {
      return this.fallback.getStockSnapshots(tickers);
    }

    const fallbackStocks = new Map((await this.fallback.getStockSnapshots(tickers)).map((stock) => [stock.profile.ticker, stock]));

    const stocks = await Promise.all(
      tickers.map(async (ticker) => {
        const fallback = fallbackStocks.get(ticker);
        if (!fallback) {
          return null;
        }

        try {
          const [quoteResponse, profileResponse, historyResponse, newsResponse, earningsResponse] = await Promise.all([
            this.client.request<FmpQuote[]>(`quote/${ticker}`),
            this.client.request<FmpProfile[]>(`profile/${ticker}`),
            this.client.request<FmpHistoricalResponse>(`historical-price-full/${ticker}`, { timeseries: 260 }),
            this.client.request<FmpNews[]>("stock_news", { tickers: ticker, limit: 3 }),
            this.client.request<FmpEarningsSurprise[]>(`earnings-surprises/${ticker}`)
          ]);

          const quote = quoteResponse?.[0];
          const profile = profileResponse?.[0];
          const history =
            historyResponse?.historical
              ?.slice(0, 260)
              .reverse()
              .map((point) => ({ date: new Date(point.date).toISOString(), close: point.close, volume: point.volume })) ?? fallback.priceHistory;
          const technicals = deriveTechnicals(history);
          const last = history.at(-1)?.close ?? quote?.price ?? fallback.quote.price;
          const base20 = history.at(-21)?.close ?? last;
          const base60 = history.at(-61)?.close ?? last;
          const base5 = history.at(-6)?.close ?? last;

          return {
            profile: {
              ticker,
              companyName: profile?.companyName ?? fallback.profile.companyName,
              sector: profile?.sector ?? fallback.profile.sector,
              industry: profile?.industry ?? fallback.profile.industry,
              themes: fallback.profile.themes,
              description: profile?.description ?? fallback.profile.description
            },
            quote: {
              ticker,
              price: quote?.price ?? last,
              change1dPct: quote?.changesPercentage ?? fallback.quote.change1dPct,
              change5dPct: ((last - base5) / base5) * 100,
              change20dPct: ((last - base20) / base20) * 100,
              change60dPct: ((last - base60) / base60) * 100,
              volume: quote?.volume ?? history.at(-1)?.volume ?? fallback.quote.volume
            },
            fundamentals: {
              marketCapBn: (quote?.marketCap ?? profile?.mktCap ?? fallback.fundamentals.marketCapBn * 1_000_000_000) / 1_000_000_000,
              averageDollarVolumeM: ((quote?.avgVolume ?? fallback.quote.volume) * (quote?.price ?? last)) / 1_000_000,
              beta: profile?.beta ?? fallback.fundamentals.beta,
              pe: quote?.pe ?? fallback.fundamentals.pe,
              priceToSales: fallback.fundamentals.priceToSales
            },
            technicals,
            earnings: {
              lastReportDate: earningsResponse?.[0]?.date ? new Date(earningsResponse[0].date).toISOString() : fallback.earnings.lastReportDate,
              nextEarningsDate: fallback.earnings.nextEarningsDate,
              revenueGrowthPct: fallback.earnings.revenueGrowthPct,
              epsSurprisePct:
                earningsResponse?.[0]?.actualEarningResult && earningsResponse?.[0]?.estimatedEarning
                  ? ((earningsResponse[0].actualEarningResult - earningsResponse[0].estimatedEarning) / earningsResponse[0].estimatedEarning) * 100
                  : fallback.earnings.epsSurprisePct,
              guidance: fallback.earnings.guidance,
              epsRevisionScore: fallback.earnings.epsRevisionScore,
              summary: fallback.earnings.summary
            },
            priceHistory: history,
            recentNews: mapNews(ticker, profile?.sector ?? fallback.profile.sector, newsResponse ?? []),
            eventCalendar: fallback.eventCalendar
          } as StockSnapshot;
        } catch {
          return fallback;
        }
      })
    );

    return stocks.filter((stock): stock is StockSnapshot => Boolean(stock));
  }
}

export class LiveNewsProvider implements NewsProvider {
  constructor(
    private readonly client: FmpClient,
    private readonly fallback = new MockNewsProvider()
  ) {}

  async getMarketNews() {
    if (!this.client.configured) {
      return this.fallback.getMarketNews();
    }

    try {
      const news = await this.client.request<FmpNews[]>("stock_news", { limit: 12 });
      return (news ?? []).slice(0, 12).map((item, index) => ({
        id: `market-live-${index}`,
        title: item.title ?? "Live market headline",
        source: item.site ?? "FMP",
        publishedAt: item.publishedDate ?? new Date().toISOString(),
        sentimentScore: 0.2,
        importanceScore: 0.55,
        tickers: [],
        sector: "Cross-Market",
        summary: item.text ?? "Imported from live provider."
      }));
    } catch {
      return this.fallback.getMarketNews();
    }
  }

  async getTickerNews(tickers: string[]) {
    if (!this.client.configured) {
      return this.fallback.getTickerNews(tickers);
    }

    const fallback = await this.fallback.getTickerNews(tickers);
    const result: Record<string, Awaited<ReturnType<MockNewsProvider["getTickerNews"]>>[string]> = { ...fallback };

    await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const news = await this.client.request<FmpNews[]>("stock_news", { tickers: ticker, limit: 3 });
          result[ticker] = mapNews(ticker, fallback[ticker]?.[0]?.sector ?? "Cross-Market", news ?? []);
        } catch {
          result[ticker] = fallback[ticker] ?? [];
        }
      })
    );

    return result;
  }
}

export class LiveFundamentalsProvider implements FundamentalsProvider {
  constructor(
    private readonly client: FmpClient,
    private readonly fallback = new MockFundamentalsProvider()
  ) {}

  async getStockProfiles(tickers: string[]): Promise<Record<string, StockProfile>> {
    const fallbackProfiles = await this.fallback.getStockProfiles(tickers);
    if (!this.client.configured) {
      return fallbackProfiles;
    }

    const result = { ...fallbackProfiles };
    await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const profile = await this.client.request<FmpProfile[]>(`profile/${ticker}`);
          const first = profile?.[0];
          if (first) {
            result[ticker] = {
              ticker,
              companyName: first.companyName ?? fallbackProfiles[ticker]?.companyName ?? ticker,
              sector: first.sector ?? fallbackProfiles[ticker]?.sector ?? "Unknown",
              industry: first.industry ?? fallbackProfiles[ticker]?.industry ?? "Unknown",
              themes: fallbackProfiles[ticker]?.themes ?? [],
              description: first.description ?? fallbackProfiles[ticker]?.description ?? `${ticker} live profile.`
            };
          }
        } catch {
          result[ticker] = fallbackProfiles[ticker];
        }
      })
    );
    return result;
  }

  async getUpcomingEvents(tickers: string[]): Promise<Record<string, StockEvent[]>> {
    return this.fallback.getUpcomingEvents(tickers);
  }
}

export class LiveCalendarProvider implements CalendarProvider {
  constructor(private readonly fallback = new MockCalendarProvider()) {}

  async getEconomicEvents() {
    return this.fallback.getEconomicEvents();
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
              "You are an institutional-style US equity research assistant. Be concise, evidence-based, and explain why a stock is worth monitoring, not blindly buying."
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

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  }

  async summarizeMarket(input: Parameters<AIProvider["summarizeMarket"]>[0]) {
    if (!this.configured) {
      return super.summarizeMarket(input);
    }

    try {
      return await this.completion(`Summarize this US market regime for a Korea-based swing trader in 3-4 sentences. Regime: ${input.market.regime}. Top sectors: ${input.sectors.slice(0, 4).map((item) => `${item.sector} ${item.score}`).join(", ")}. Key headlines: ${input.news.slice(0, 4).map((item) => item.title).join(" | ")}`);
    } catch {
      return super.summarizeMarket(input);
    }
  }

  async summarizeThemes(input: Parameters<AIProvider["summarizeThemes"]>[0]) {
    if (!this.configured) {
      return super.summarizeThemes(input);
    }

    try {
      return await this.completion(`Summarize the strongest US equity themes in 3 sentences. Themes: ${input.themes.slice(0, 5).map((item) => `${item.name} score ${item.score}`).join(", ")}. Headlines: ${input.news.slice(0, 3).map((item) => item.title).join(" | ")}`);
    } catch {
      return super.summarizeThemes(input);
    }
  }

  async summarizeStock(input: { candidate: CandidateStock }): Promise<Pick<StockNarrative, "bullishFactors" | "bearishFactors" | "whatToWatchNext">> {
    if (!this.configured) {
      return super.summarizeStock(input);
    }

    try {
      const response = await this.completion(`Return three short lines separated by || for bullish factors, bearish factors, and what to watch next for ${input.candidate.profile.ticker}. Score ${input.candidate.score.finalScore.toFixed(1)}, label ${input.candidate.label}, themes ${input.candidate.profile.themes.join(", ")}.`);
      const [bullish, bearish, next] = response.split("||").map((item) => item.trim());
      return {
        bullishFactors: [bullish || `Sector strength remains supportive for ${input.candidate.profile.ticker}.`],
        bearishFactors: [bearish || `Risk management still matters given the current setup.`],
        whatToWatchNext: [next || `Watch for price confirmation through the next trigger level.`]
      };
    } catch {
      return super.summarizeStock(input);
    }
  }
}
