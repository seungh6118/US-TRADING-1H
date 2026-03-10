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
}

export interface OvernightRawCandidate {
  ticker: string;
  companyName: string;
  sector: string;
  industry: string;
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
  news: OvernightNewsItem[];
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
}

export interface OvernightMarketBrief {
  timestampLabel: string;
  marketTone: "risk-on" | "balanced" | "risk-off";
  closeCountdownMinutes: number;
  summary: string;
  sectorLeaders: string[];
  riskFlags: string[];
}

export interface OvernightAlert {
  id: string;
  title: string;
  detail: string;
}

export interface OvernightDashboardData {
  generatedAt: string;
  marketBrief: OvernightMarketBrief;
  settings: OvernightSettings;
  candidates: OvernightCandidate[];
  topCandidates: OvernightCandidate[];
  alerts: OvernightAlert[];
}
