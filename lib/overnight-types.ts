export type OvernightGrade = "A" | "B" | "C" | "Excluded";
export type SentimentTone = "positive" | "neutral" | "negative";
export type PostMarketSuitability = "ideal" | "allowed" | "avoid";
export type CatalystTag =
  | "earnings"
  | "guidance"
  | "contract"
  | "policy"
  | "analyst"
  | "theme"
  | "dilution"
  | "litigation"
  | "downgrade";
export type OvernightDataMode = "live" | "mock";
export type OvernightMarketTone = "risk-on" | "balanced" | "risk-off";

export interface OvernightSettings {
  minPrice: number;
  minAverageVolume: number;
  minAverageDollarVolumeM: number;
  minMarketCapBn: number;
  onlyAGrade: boolean;
  excludeUpcomingEarnings: boolean;
  allowPostMarket: boolean;
  autoRefreshSeconds: number;
  weights: {
    liquidity: number;
    intradayStrength: number;
    flowVolume: number;
    catalystMomentum: number;
    nextDayRealizability: number;
  };
  newsWeightMultiplier: number;
  sectorWeightMultiplier: number;
}

export interface OvernightNewsItem {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  sentiment: SentimentTone;
  catalyst: CatalystTag;
  summary: string;
  url: string;
  relatedTickers: string[];
}

export interface OvernightBacktestTrade {
  signalDate: string;
  close: number;
  nextOpen: number;
  nextHigh: number;
  nextClose: number;
  gapPct: number;
  maxGainPct: number;
  nextClosePct: number;
}

export interface OvernightBacktestSummary {
  lookbackSessions: number;
  sampleSize: number;
  gapUpRatePct: number;
  targetHitRatePct: number;
  averageGapPct: number;
  averageMaxGainPct: number;
  averageNextClosePct: number;
  recentTrades: OvernightBacktestTrade[];
}

export interface OvernightRawCandidate {
  ticker: string;
  companyName: string;
  sector: string;
  industry: string;
  universeTags: string[];
  price: number;
  dayChangePct: number;
  dayHigh: number;
  dayLow: number;
  close: number;
  vwap: number;
  marketCapBn: number;
  averageVolume: number;
  averageDollarVolumeM: number;
  spreadBps: number;
  closeStrength30m: number;
  close30mVolumeRatio: number;
  rvol20: number;
  closeAuctionConcentration: number;
  heavySelloffPenalty: number;
  earningsSurpriseScore: number;
  guidanceScore: number;
  contractScore: number;
  policyScore: number;
  analystScore: number;
  themeScore: number;
  negativeHeadlinePenalty: number;
  dilutionPenalty: number;
  litigationPenalty: number;
  sectorMomentumScore: number;
  premarketInterestScore: number;
  afterHoursChangePct: number;
  afterHoursVolumeRatio: number;
  afterHoursSpreadStable: number;
  distanceToResistancePct: number;
  daysToEarnings: number;
  supportLevel: number;
  resistanceLevel: number;
  postMarketSuitability: PostMarketSuitability;
  marketState: string;
  news: OvernightNewsItem[];
  backtest: OvernightBacktestSummary;
}

export interface OvernightScoreBreakdown {
  liquidity: number;
  intradayStrength: number;
  flowVolume: number;
  catalystMomentum: number;
  nextDayRealizability: number;
  total: number;
  grade: OvernightGrade;
}

export interface OvernightScenarioSet {
  primary: string;
  alternate: string;
  exitPlan: string;
}

export interface OvernightCandidate {
  ticker: string;
  companyName: string;
  sector: string;
  industry: string;
  universeTags: string[];
  price: number;
  dayChangePct: number;
  afterHoursChangePct: number;
  averageVolume: number;
  averageDollarVolumeM: number;
  marketCapBn: number;
  spreadBps: number;
  closeToHighPct: number;
  closeAboveVWAPPct: number;
  closeStrength30m: number;
  close30mVolumeRatio: number;
  rvol20: number;
  closeAuctionConcentration: number;
  distanceToResistancePct: number;
  daysToEarnings: number;
  sectorMomentumScore: number;
  supportLevel: number;
  resistanceLevel: number;
  postMarketSuitability: PostMarketSuitability;
  marketState: string;
  score: OvernightScoreBreakdown;
  reasons: string[];
  risks: string[];
  coreSummary: string;
  scenario: OvernightScenarioSet;
  entryIdea: string;
  exitIdea: string;
  closeTapeNote: string;
  overnightRiskNote: string;
  news: OvernightNewsItem[];
  backtest: OvernightBacktestSummary;
}

export interface OvernightMarketBrief {
  timestampLabel: string;
  marketTone: OvernightMarketTone;
  closeCountdownMinutes: number;
  summary: string;
  indexFlow: string[];
  sectorLeaders: string[];
  weakGroups: string[];
  riskFlags: string[];
  standoutTickers: string[];
}

export interface OvernightAlert {
  id: string;
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
}

export interface OvernightDataStatus {
  mode: OvernightDataMode;
  provider: string;
  warning: string | null;
  notes: string[];
  lastSuccessfulAt: string;
}

export interface StoredOvernightSnapshotCandidate {
  ticker: string;
  companyName: string;
  close: number;
  score: number;
  grade: OvernightGrade;
  postMarketSuitability: PostMarketSuitability;
}

export interface StoredOvernightSnapshot {
  id: string;
  sessionDate: string;
  recordedAt: string;
  candidates: StoredOvernightSnapshotCandidate[];
}

export interface OvernightStrategyBacktestResult {
  snapshotId: string;
  sessionDate: string;
  ticker: string;
  close: number;
  nextOpen: number;
  nextHigh: number;
  nextClose: number;
  gapPct: number;
  highPct: number;
  closePct: number;
}

export interface OvernightStrategyBacktest {
  completedTrades: number;
  gapWinRatePct: number;
  averageGapPct: number;
  averageHighPct: number;
  averageClosePct: number;
  recentResults: OvernightStrategyBacktestResult[];
}

export interface OvernightDashboardData {
  generatedAt: string;
  status: OvernightDataStatus;
  marketBrief: OvernightMarketBrief;
  settings: OvernightSettings;
  candidates: OvernightCandidate[];
  topCandidates: OvernightCandidate[];
  alerts: OvernightAlert[];
  universeCount: number;
  strategyBacktest: OvernightStrategyBacktest | null;
}
