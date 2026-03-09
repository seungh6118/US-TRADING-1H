import {
  AIProvider,
  CalendarProvider,
  CandidateStock,
  FundamentalsProvider,
  MarketDataProvider,
  NewsProvider,
  SectorPerformance,
  StockEvent,
  StockNarrative,
  StockProfile,
  ThemeSnapshot
} from "@/lib/types";
import {
  getAllMockStockSnapshots,
  getMockEconomicEvents,
  getMockMacroSnapshot,
  getMockMarketNews,
  getMockSectorPerformance,
  getMockStockSnapshots,
  getMockThemeSnapshots
} from "@/providers/mock/mock-data";

function summarizeTopThemes(themes: ThemeSnapshot[]): string {
  return themes
    .slice(0, 5)
    .map((theme) => `${theme.name} (${theme.score.toFixed(0)})`)
    .join(", ");
}

function summarizeTopSectors(sectors: SectorPerformance[]): string {
  return sectors
    .slice(0, 3)
    .map((sector) => `${sector.sector} (${sector.score.toFixed(0)})`)
    .join(", ");
}

export class MockMarketDataProvider implements MarketDataProvider {
  async getMacroSnapshot() {
    return getMockMacroSnapshot();
  }

  async getSectorPerformance() {
    return getMockSectorPerformance();
  }

  async getThemeSnapshots() {
    return getMockThemeSnapshots();
  }

  async getStockSnapshots(tickers: string[]) {
    return getMockStockSnapshots(tickers);
  }
}

export class MockNewsProvider implements NewsProvider {
  async getMarketNews() {
    return getMockMarketNews();
  }

  async getTickerNews(tickers: string[]) {
    const map: Record<string, ReturnType<typeof getAllMockStockSnapshots>[number]["recentNews"]> = {};
    getAllMockStockSnapshots().forEach((stock) => {
      if (tickers.includes(stock.profile.ticker)) {
        map[stock.profile.ticker] = stock.recentNews;
      }
    });
    return map;
  }
}

export class MockFundamentalsProvider implements FundamentalsProvider {
  async getStockProfiles(tickers: string[]): Promise<Record<string, StockProfile>> {
    const map: Record<string, StockProfile> = {};
    getAllMockStockSnapshots().forEach((stock) => {
      if (tickers.includes(stock.profile.ticker)) {
        map[stock.profile.ticker] = stock.profile;
      }
    });
    return map;
  }

  async getUpcomingEvents(tickers: string[]): Promise<Record<string, StockEvent[]>> {
    const map: Record<string, StockEvent[]> = {};
    getAllMockStockSnapshots().forEach((stock) => {
      if (tickers.includes(stock.profile.ticker)) {
        map[stock.profile.ticker] = stock.eventCalendar;
      }
    });
    return map;
  }
}

export class MockCalendarProvider implements CalendarProvider {
  async getEconomicEvents() {
    return getMockEconomicEvents();
  }
}

export class TemplateAIProvider implements AIProvider {
  async summarizeMarket(input: Parameters<AIProvider["summarizeMarket"]>[0]) {
    const topSectors = summarizeTopSectors([...input.sectors].sort((a, b) => b.score - a.score));
    const macroTone = input.market.regime === "risk-on" ? "risk appetite remains supportive" : "macro tone is mixed";
    return `${macroTone}, led by ${topSectors}. Falling volatility and a softer dollar are helping growth leadership, but the upcoming macro calendar argues against chasing already extended names. The better use case right now is to rank names with clean structure and clear invalidation rather than force fresh entries everywhere.`;
  }

  async summarizeThemes(input: Parameters<AIProvider["summarizeThemes"]>[0]) {
    return `Top themes are ${summarizeTopThemes([...input.themes].sort((a, b) => b.score - a.score))}. AI and semiconductor leadership still set the pace, while power infrastructure is emerging as the best secondary theme because price action and news flow are both confirming. Cybersecurity remains selective rather than broad, which keeps stock picking more important than blanket sector exposure.`;
  }

  async summarizeStock(input: { candidate: CandidateStock }): Promise<Pick<StockNarrative, "bullishFactors" | "bearishFactors" | "whatToWatchNext">> {
    const { candidate } = input;
    return {
      bullishFactors: [
        `${candidate.profile.sector} relative strength remains supportive.`,
        `The stock sits ${candidate.technicals.distanceFromHighPct.toFixed(1)}% below the 52-week high, which keeps it relevant on watch.`
      ],
      bearishFactors: [
        `Risk penalty is ${candidate.score.riskPenalty.toFixed(1)}, so timing still matters.`,
        `Upcoming event risk around ${candidate.eventCalendar[0]?.title ?? "near-term catalysts"} can raise volatility.`
      ],
      whatToWatchNext: [
        `Confirmation above ${candidate.keyLevels.breakout.toFixed(2)} with volume would strengthen the setup.`,
        `Loss of ${candidate.keyLevels.invalidation.toFixed(2)} would weaken the thesis.`
      ]
    };
  }
}
