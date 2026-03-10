export type AppMode = "mock" | "live";
export type ProviderRuntime = "mock" | "live" | "hybrid";
export type MarketRegime = "risk-on" | "neutral" | "risk-off";
export type CandidateLabel =
  | "Breakout candidate"
  | "Pullback candidate"
  | "Earnings watch"
  | "Watch"
  | "Avoid";
export type AlertSeverity = "high" | "medium" | "low";
export type ImpactLevel = "high" | "medium" | "low";
export type GuidanceTone = "raised" | "inline" | "cut";
export type UniverseKey =
  | "sp500"
  | "nasdaq100"
  | "magnificent7"
  | "semiconductors"
  | "defense"
  | "powerInfrastructure"
  | "custom";

export interface AppStatus {
  requestedMode: AppMode;
  runtimeMode: ProviderRuntime;
  note: string;
}

export interface InstrumentSnapshot {
  symbol: string;
  name: string;
  value: number;
  change1dPct: number;
  change5dPct: number;
  trend: "up" | "flat" | "down";
}

export interface EconomicEvent {
  id: string;
  title: string;
  date: string;
  impact: ImpactLevel;
  note: string;
}

export interface MarketMacroSnapshot {
  asOf: string;
  regime: MarketRegime;
  indices: InstrumentSnapshot[];
  macroAssets: InstrumentSnapshot[];
  economicEvents: EconomicEvent[];
  aiSummary: string;
}

export interface SectorPerformance {
  sector: string;
  etf: string;
  performance1dPct: number;
  performance5dPct: number;
  performance20dPct: number;
  performance60dPct: number;
  relativeStrength: number;
  score: number;
  drivers: string[];
}

export interface ThemeSnapshot {
  name: string;
  newsMentions: number;
  sentimentScore: number;
  priceMomentumScore: number;
  score: number;
  linkedTickers: string[];
  summary: string;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  sentimentScore: number;
  importanceScore: number;
  tickers: string[];
  sector: string;
  summary: string;
}

export interface EarningsSummary {
  lastReportDate: string;
  nextEarningsDate: string | null;
  revenueGrowthPct: number;
  epsSurprisePct: number;
  guidance: GuidanceTone;
  epsRevisionScore: number;
  summary: string;
}

export interface StockEvent {
  id: string;
  title: string;
  date: string;
  category: "earnings" | "macro" | "product" | "regulatory";
  note: string;
}

export interface StockProfile {
  ticker: string;
  companyName: string;
  sector: string;
  industry: string;
  themes: string[];
  description: string;
}

export interface StockQuote {
  ticker: string;
  price: number;
  change1dPct: number;
  change5dPct: number;
  change20dPct: number;
  change60dPct: number;
  volume: number;
}

export interface StockFundamentals {
  marketCapBn: number;
  averageDollarVolumeM: number;
  beta: number;
  pe: number | null;
  priceToSales: number | null;
}

export interface StockTechnicals {
  ma20: number;
  ma50: number;
  ma200: number;
  high52w: number;
  low52w: number;
  relativeStrengthLine: number;
  volumeRatio: number;
  atrPct: number;
  distanceFromHighPct: number;
  pullbackDepthPct: number;
}

export interface PricePoint {
  date: string;
  close: number;
  volume: number;
}

export interface StockSnapshot {
  profile: StockProfile;
  quote: StockQuote;
  fundamentals: StockFundamentals;
  technicals: StockTechnicals;
  earnings: EarningsSummary;
  priceHistory: PricePoint[];
  recentNews: NewsItem[];
  eventCalendar: StockEvent[];
}

export interface ScoreBreakdown {
  macroFit: number;
  sectorStrength: number;
  themeStrength: number;
  earningsNews: number;
  priceStructure: number;
  flowVolume: number;
  valuationSanity: number;
  riskPenalty: number;
  finalScore: number;
}

export interface StockNarrative {
  whyWatch: string[];
  whyNotYet: string[];
  confirmation: string[];
  invalidation: string[];
  bullishFactors: string[];
  bearishFactors: string[];
  whatToWatchNext: string[];
}

export interface KeyLevels {
  breakout: number;
  support: number;
  invalidation: number;
  tacticalEntry: number;
}

export interface CandidateStock extends StockSnapshot {
  score: ScoreBreakdown;
  label: CandidateLabel;
  narrative: StockNarrative;
  keyLevels: KeyLevels;
}

export interface RiskAlert {
  id: string;
  ticker?: string;
  title: string;
  reason: string;
  severity: AlertSeverity;
  category: "earnings" | "volatility" | "overextended" | "headline" | "macro";
}

export interface WatchlistSnapshotItem {
  ticker: string;
  companyName: string;
  date: string;
  score: number;
  label: CandidateLabel;
  reason: string;
  keyLevel: number;
  invalidation: string;
  nextCheckpoint: string;
  deltaFromPrior: number;
  isNew: boolean;
}

export interface SavedWatchlistItem {
  ticker: string;
  note: string | null;
  createdAt: string;
}

export interface WatchlistSummary {
  snapshotDate: string;
  items: WatchlistSnapshotItem[];
  removedTickers: string[];
  saved: SavedWatchlistItem[];
}

export interface MarketDailyRecap {
  sessionDate: string;
  indexFlow: string[];
  strongAreas: string[];
  weakAreas: string[];
  standoutMovers: string[];
  interpretation: string;
}

export interface DashboardData {
  status: AppStatus;
  generatedAt: string;
  universe: UniverseKey;
  market: MarketMacroSnapshot;
  marketRecap: MarketDailyRecap;
  sectors: SectorPerformance[];
  themes: ThemeSnapshot[];
  candidates: CandidateStock[];
  riskAlerts: RiskAlert[];
  watchlist: WatchlistSummary;
  marketNewsSummary: string;
  themeSummary: string;
  topActionable: CandidateStock[];
  avoidList: CandidateStock[];
}

export interface DashboardFilters {
  marketCapMinBn: number;
  averageDollarVolumeMinM: number;
  sector: string | "All";
  volatilityMaxPct: number;
  excludeEarningsWindow: boolean;
}

export interface StockDetailData {
  status: AppStatus;
  generatedAt: string;
  candidate: CandidateStock;
  peerCandidates: CandidateStock[];
}

export interface UniverseDefinition {
  key: UniverseKey;
  label: string;
  description: string;
  tickers: string[];
}

export interface MarketDataProvider {
  getMacroSnapshot(): Promise<Omit<MarketMacroSnapshot, "aiSummary">>;
  getSectorPerformance(): Promise<SectorPerformance[]>;
  getThemeSnapshots(): Promise<ThemeSnapshot[]>;
  getStockSnapshots(tickers: string[]): Promise<StockSnapshot[]>;
}

export interface NewsProvider {
  getMarketNews(): Promise<NewsItem[]>;
  getTickerNews(tickers: string[]): Promise<Record<string, NewsItem[]>>;
}

export interface FundamentalsProvider {
  getStockProfiles(tickers: string[]): Promise<Record<string, StockProfile>>;
  getUpcomingEvents(tickers: string[]): Promise<Record<string, StockEvent[]>>;
}

export interface CalendarProvider {
  getEconomicEvents(): Promise<EconomicEvent[]>;
}

export interface AIProvider {
  summarizeMarket(input: {
    market: Omit<MarketMacroSnapshot, "aiSummary">;
    sectors: SectorPerformance[];
    news: NewsItem[];
  }): Promise<string>;
  summarizeThemes(input: {
    themes: ThemeSnapshot[];
    news: NewsItem[];
  }): Promise<string>;
  summarizeStock(input: {
    candidate: CandidateStock;
  }): Promise<Pick<StockNarrative, "bullishFactors" | "bearishFactors" | "whatToWatchNext">>;
}

export interface ProviderSet {
  marketDataProvider: MarketDataProvider;
  newsProvider: NewsProvider;
  fundamentalsProvider: FundamentalsProvider;
  calendarProvider: CalendarProvider;
  aiProvider: AIProvider;
  status: AppStatus;
}
