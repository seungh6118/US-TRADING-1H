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
import { displaySector, displayTheme } from "@/lib/localization";
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
    .map((theme) => `${displayTheme(theme.name)} (${theme.score.toFixed(0)})`)
    .join(", ");
}

function summarizeTopSectors(sectors: SectorPerformance[]): string {
  return sectors
    .slice(0, 3)
    .map((sector) => `${displaySector(sector.sector)} (${sector.score.toFixed(0)})`)
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
    const macroTone = input.market.regime === "risk-on" ? "현재는 리스크 선호 흐름이 우세합니다" : "매크로 환경은 아직 완전히 편안하지 않습니다";
    return `${macroTone}. 강한 섹터는 ${topSectors}입니다. 변동성 완화와 달러 약세가 성장 리더를 돕고 있지만, 가까운 경제 일정 때문에 이미 많이 오른 종목은 추격보다 눌림 확인이 더 적절합니다. 지금은 아무 종목이나 사는 구간이 아니라 구조가 깔끔하고 무효화 기준이 분명한 종목을 압축해서 보는 구간입니다.`;
  }

  async summarizeThemes(input: Parameters<AIProvider["summarizeThemes"]>[0]) {
    return `지금 강한 테마는 ${summarizeTopThemes([...input.themes].sort((a, b) => b.score - a.score))}입니다. AI와 반도체가 여전히 시장 리더십을 주도하고 있고, 전력 인프라는 뉴스 흐름과 가격 반응이 함께 강한 보조 축으로 올라오고 있습니다. 사이버보안은 시장 전체보다 종목 선별이 더 중요한 구간입니다.`;
  }

  async summarizeStock(input: { candidate: CandidateStock }): Promise<Pick<StockNarrative, "bullishFactors" | "bearishFactors" | "whatToWatchNext">> {
    const { candidate } = input;
    return {
      bullishFactors: [
        `${displaySector(candidate.profile.sector)} 상대강도가 현재 시장에서 우위입니다.`,
        `52주 고점 대비 ${candidate.technicals.distanceFromHighPct.toFixed(1)}% 아래에 있어 감시 가치가 유지됩니다.`
      ],
      bearishFactors: [
        `리스크 패널티가 ${candidate.score.riskPenalty.toFixed(1)}점이라 진입 전 손절 기준 관리가 필요합니다.`,
        `${candidate.eventCalendar[0]?.title ?? "가까운 이벤트"}를 앞두고 단기 변동성이 커질 수 있습니다.`
      ],
      whatToWatchNext: [
        `${candidate.keyLevels.breakout.toFixed(2)} 돌파가 거래량과 함께 나오는지 확인하세요.`,
        `${candidate.keyLevels.invalidation.toFixed(2)} 이탈 시에는 시나리오를 다시 점검해야 합니다.`
      ]
    };
  }
}