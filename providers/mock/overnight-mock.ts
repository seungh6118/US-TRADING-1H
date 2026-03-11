import { OvernightBacktestSummary, OvernightMarketBrief, OvernightRawCandidate } from "@/lib/overnight-types";

const now = "2026-03-11T19:45:00.000Z";

function mockBacktest(): OvernightBacktestSummary {
  return {
    lookbackSessions: 20,
    sampleSize: 8,
    gapUpRatePct: 62.5,
    targetHitRatePct: 50,
    averageGapPct: 0.9,
    averageMaxGainPct: 2.3,
    averageNextClosePct: 1.1,
    recentTrades: [
      {
        signalDate: "2026-03-06",
        close: 182.65,
        nextOpen: 183.9,
        nextHigh: 186.44,
        nextClose: 184.77,
        gapPct: 0.7,
        maxGainPct: 2.1,
        nextClosePct: 1.2
      }
    ]
  };
}

function news(id: string, title: string, sentiment: "positive" | "neutral" | "negative", catalyst: OvernightRawCandidate["news"][number]["catalyst"], summary: string) {
  return {
    id,
    title,
    source: "MockWire",
    publishedAt: now,
    sentiment,
    catalyst,
    summary,
    url: "https://example.com",
    relatedTickers: ["NVDA"]
  };
}

export const mockOvernightMarketBrief: OvernightMarketBrief = {
  timestampLabel: "모의 데이터 · 15:45 ET",
  marketTone: "risk-on",
  closeCountdownMinutes: 15,
  summary: "반도체와 전력 인프라가 강하고, 장 막판에도 수급이 유지되는 종목이 위로 올라오는 샘플 상태입니다.",
  indexFlow: ["QQQ 강세", "SPY 견조", "VIX 안정"],
  sectorLeaders: ["반도체", "전력 인프라", "AI 하드웨어"],
  weakGroups: ["은행", "주택건설"],
  riskFlags: ["실적 3일 이내 종목 제외 권장"],
  standoutTickers: ["NVDA", "VRT", "AVGO"]
};

export const mockOvernightUniverse: OvernightRawCandidate[] = [
  {
    ticker: "NVDA",
    companyName: "NVIDIA Corporation",
    sector: "Technology",
    industry: "Semiconductors",
    universeTags: ["day_gainers", "most_actives"],
    price: 184.77,
    dayChangePct: 1.2,
    dayHigh: 186.44,
    dayLow: 182.01,
    close: 184.77,
    vwap: 184.02,
    marketCapBn: 4490,
    averageVolume: 176_907_150,
    averageDollarVolumeM: 32_700,
    spreadBps: 4.6,
    closeStrength30m: 1.1,
    close30mVolumeRatio: 1.22,
    rvol20: 1.01,
    closeAuctionConcentration: 10.8,
    heavySelloffPenalty: 4,
    earningsSurpriseScore: 72,
    guidanceScore: 70,
    contractScore: 30,
    policyScore: 12,
    analystScore: 88,
    themeScore: 94,
    negativeHeadlinePenalty: 4,
    dilutionPenalty: 0,
    litigationPenalty: 0,
    sectorMomentumScore: 86,
    premarketInterestScore: 82,
    afterHoursChangePct: -0.01,
    afterHoursVolumeRatio: 0.15,
    afterHoursSpreadStable: 92,
    distanceToResistancePct: 3.9,
    daysToEarnings: 70,
    supportLevel: 182.3,
    resistanceLevel: 188.5,
    postMarketSuitability: "ideal",
    marketState: "POSTPOST",
    news: [
      news("nvda-1", "AI 수요와 실적 모멘텀이 유지", "positive", "theme", "AI 수요와 실적 기대가 함께 살아 있는 상태입니다.")
    ],
    backtest: mockBacktest()
  }
];
