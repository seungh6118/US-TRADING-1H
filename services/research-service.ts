import { appConfig } from "@/lib/config";
import { universeDefinitions } from "@/lib/constants";
import { DashboardData, StockDetailData, UniverseKey } from "@/lib/types";
import { getProviderSet } from "@/providers/factory";
import { buildRiskAlerts, scoreCandidate } from "@/scoring";
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
  const [marketBase, sectors, themes, marketNews, stocks] = await Promise.all([
    providers.marketDataProvider.getMacroSnapshot(),
    providers.marketDataProvider.getSectorPerformance(),
    providers.marketDataProvider.getThemeSnapshots(),
    providers.newsProvider.getMarketNews(),
    providers.marketDataProvider.getStockSnapshots(tickers)
  ]);

  const [marketSummary, themeSummary] = await Promise.all([
    providers.aiProvider.summarizeMarket({ market: marketBase, sectors, news: marketNews }),
    providers.aiProvider.summarizeThemes({ themes, news: marketNews })
  ]);

  const market = { ...marketBase, aiSummary: marketSummary };
  const candidates = stocks
    .map((stock) => scoreCandidate(stock, { market, sectors, themes }))
    .sort((left, right) => right.score.finalScore - left.score.finalScore);

  const watchlist = ensureWatchlistSnapshot("sp500", candidates);
  const topActionable = candidates.filter((candidate) => ["Breakout candidate", "Pullback candidate"].includes(candidate.label)).slice(0, 3);
  const avoidList = candidates.filter((candidate) => candidate.label === "Avoid").slice(0, 3);

  return {
    status: providers.status,
    generatedAt: new Date().toISOString(),
    universe,
    market,
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
  const dashboard = await getDashboardData(appConfig.defaultUniverse, Array.from(new Set([...appConfig.customTickers, ticker])));
  const candidate = dashboard.candidates.find((item) => item.profile.ticker === ticker);

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
      .filter((item) => item.profile.sector === candidate.profile.sector && item.profile.ticker !== ticker)
      .slice(0, 4)
  };
}
