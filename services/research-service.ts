import { appConfig } from "@/lib/config";
import { LiveDataUnavailableError } from "@/lib/errors";
import { universeDefinitions } from "@/lib/constants";
import { DashboardData, StockDetailData, UniverseKey } from "@/lib/types";
import { getProviderSet } from "@/providers/factory";
import { buildRiskAlerts, scoreCandidate } from "@/scoring";
import { buildLiveSectorPerformance, buildLiveThemeSnapshots } from "@/services/live-analytics";
import { buildLiveMarketRecap, buildMockMarketRecap } from "@/services/market-recap";
import { ensureWatchlistSnapshot } from "@/services/watchlist-service";

function resolveUniverseTickers(universe: UniverseKey, customTickers: string[] = []): string[] {
  if (universe === "custom") {
    return customTickers.length > 0 ? customTickers : appConfig.customTickers;
  }

  return universeDefinitions.find((definition) => definition.key === universe)?.tickers ?? [];
}

export async function getDashboardData(
  universe: UniverseKey = appConfig.defaultUniverse,
  customTickers: string[] = appConfig.customTickers
): Promise<DashboardData> {
  const providers = getProviderSet();
  const tickers = resolveUniverseTickers(universe, customTickers);
  const [marketBase, marketNews, stocks] = await Promise.all([
    providers.marketDataProvider.getMacroSnapshot(),
    providers.newsProvider.getMarketNews(),
    providers.marketDataProvider.getStockSnapshots(tickers)
  ]);

  if (providers.status.runtimeMode !== "mock" && stocks.length === 0) {
    throw new LiveDataUnavailableError("실시간 데이터 공급원에서 유효한 종목 데이터를 받지 못했습니다.");
  }

  const sectors = providers.status.runtimeMode === "mock" ? await providers.marketDataProvider.getSectorPerformance() : buildLiveSectorPerformance(stocks);
  const themes = providers.status.runtimeMode === "mock" ? await providers.marketDataProvider.getThemeSnapshots() : buildLiveThemeSnapshots(stocks);
  const marketRecap = providers.status.runtimeMode === "mock" ? buildMockMarketRecap() : await buildLiveMarketRecap(stocks);

  const [themeSummary] = await Promise.all([providers.aiProvider.summarizeThemes({ themes, news: marketNews })]);
  const marketSummary = marketRecap.interpretation;

  const market = { ...marketBase, aiSummary: marketSummary };
  const candidates = stocks
    .map((stock) => scoreCandidate(stock, { market, sectors, themes }))
    .sort((left, right) => right.score.finalScore - left.score.finalScore);

  const watchlist = ensureWatchlistSnapshot(universe, candidates);
  const topActionable = candidates.filter((candidate) => ["Breakout candidate", "Pullback candidate"].includes(candidate.label)).slice(0, 3);
  const avoidList = candidates.filter((candidate) => candidate.label === "Avoid").slice(0, 3);

  return {
    status: providers.status,
    generatedAt: new Date().toISOString(),
    universe,
    market,
    marketRecap,
    sectors,
    themes,
    candidates,
    riskAlerts: buildRiskAlerts(candidates, market),
    watchlist,
    marketNewsSummary: marketSummary,
    themeSummary,
    topActionable,
    avoidList
  };
}

export async function getStockDetail(ticker: string): Promise<StockDetailData | null> {
  const normalizedTicker = ticker.toUpperCase();
  const peerUniverseTickers = resolveUniverseTickers(appConfig.defaultUniverse, appConfig.customTickers);
  const detailUniverseTickers = Array.from(new Set([...peerUniverseTickers, normalizedTicker]));
  const dashboard = await getDashboardData("custom", detailUniverseTickers);
  const candidate = dashboard.candidates.find((item) => item.profile.ticker === normalizedTicker);

  if (!candidate) {
    return null;
  }

  const providers = getProviderSet();
  const aiNarrative = await providers.aiProvider.summarizeStock({ candidate });
  return {
    status: dashboard.status,
    generatedAt: dashboard.generatedAt,
    candidate: {
      ...candidate,
      narrative: {
        ...candidate.narrative,
        ...aiNarrative
      }
    },
    peerCandidates: dashboard.candidates
      .filter((item) => item.profile.sector === candidate.profile.sector && item.profile.ticker !== normalizedTicker)
      .slice(0, 4)
  };
}
