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
    const macroTone =
      input.market.regime === "risk-on"
        ? "현재 시장은 공격주에도 기회가 남아 있는 편입니다"
        : input.market.regime === "risk-off"
          ? "현재 시장은 방어적으로 접근하는 편이 유리합니다"
          : "현재 시장은 방향성이 강하지 않아 종목 선별이 특히 중요합니다";

    return `${macroTone}. 상위 섹터는 ${topSectors}입니다. 다만 경제 일정이 가까워 추격 매수보다는 지지 확인 뒤에 접근하는 편이 좋습니다. 지금 단계에서는 아무 종목이나 사는 앱이 아니라, 이번 주 계속 볼 이름을 압축하는 도구로 쓰는 것이 맞습니다.`;
  }

  async summarizeThemes(input: Parameters<AIProvider["summarizeThemes"]>[0]) {
    return `지금 점수가 높은 테마는 ${summarizeTopThemes([...input.themes].sort((a, b) => b.score - a.score))}입니다. AI와 반도체는 여전히 핵심 축이지만, 종목별 차트 구조 차이가 커져 같은 테마 안에서도 선별이 중요합니다. 전력 인프라와 사이버보안은 보조 리더군으로 관찰 가치가 있습니다.`;
  }

  async summarizeStock(input: { candidate: CandidateStock }): Promise<Pick<StockNarrative, "bullishFactors" | "bearishFactors" | "whatToWatchNext">> {
    const { candidate } = input;

    return {
      bullishFactors: [
        `${displaySector(candidate.profile.sector)} 내 상대 위치가 아직 크게 무너지지 않았습니다.`,
        `52주 고점 대비 ${candidate.technicals.distanceFromHighPct.toFixed(1)}% 아래에 있어 구조 회복 시 재평가 여지가 있습니다.`
      ],
      bearishFactors: [
        `리스크 패널티가 ${candidate.score.riskPenalty.toFixed(1)}점으로 단기 이벤트 관리가 필요합니다.`,
        `${candidate.eventCalendar[0]?.title ?? "가까운 이벤트"} 전까지는 변동성 확대 가능성을 열어둬야 합니다.`
      ],
      whatToWatchNext: [
        `${candidate.keyLevels.breakout.toFixed(2)} 돌파가 거래량과 함께 나오는지 확인하세요.`,
        `${candidate.keyLevels.invalidation.toFixed(2)} 아래로 밀리면 시나리오를 다시 점검하는 편이 좋습니다.`
      ]
    };
  }
}
