import {
  EconomicEvent,
  InstrumentSnapshot,
  NewsItem,
  PricePoint,
  SectorPerformance,
  StockEvent,
  StockSnapshot,
  ThemeSnapshot
} from "@/lib/types";
import { average, getDateOffset, movingAverage, pseudoRandom } from "@/lib/utils";

type SetupProfile = "breakout" | "pullback" | "watch" | "earnings" | "avoid";

type StockSeed = {
  ticker: string;
  companyName: string;
  sector: string;
  industry: string;
  themes: string[];
  description: string;
  currentPrice: number;
  startMultiplier: number;
  baseVolume: number;
  volumeRatioTarget: number;
  marketCapBn: number;
  averageDollarVolumeM: number;
  beta: number;
  pe: number | null;
  priceToSales: number | null;
  setup: SetupProfile;
  revenueGrowthPct: number;
  epsSurprisePct: number;
  guidance: "raised" | "inline" | "cut";
  epsRevisionScore: number;
  nextEarningsOffsetDays: number;
  newsTone: number;
  eventNote: string;
};

const stockSeeds: StockSeed[] = [
  {
    ticker: "NVDA",
    companyName: "NVIDIA",
    sector: "Semiconductors",
    industry: "AI Accelerators",
    themes: ["AI", "Semiconductor"],
    description: "Compute leader benefiting from hyperscaler and sovereign AI capex.",
    currentPrice: 984,
    startMultiplier: 0.48,
    baseVolume: 44_000_000,
    volumeRatioTarget: 1.55,
    marketCapBn: 2410,
    averageDollarVolumeM: 41200,
    beta: 1.72,
    pe: 41,
    priceToSales: 23,
    setup: "breakout",
    revenueGrowthPct: 81,
    epsSurprisePct: 11.2,
    guidance: "raised",
    epsRevisionScore: 88,
    nextEarningsOffsetDays: 24,
    newsTone: 0.82,
    eventNote: "Cloud capex commentary remains the next catalyst."
  },
  {
    ticker: "AVGO",
    companyName: "Broadcom",
    sector: "Semiconductors",
    industry: "Connectivity & AI ASIC",
    themes: ["AI", "Semiconductor"],
    description: "Custom AI silicon and networking demand keeps revisions positive.",
    currentPrice: 1528,
    startMultiplier: 0.56,
    baseVolume: 3_900_000,
    volumeRatioTarget: 1.42,
    marketCapBn: 710,
    averageDollarVolumeM: 6100,
    beta: 1.11,
    pe: 29,
    priceToSales: 16,
    setup: "breakout",
    revenueGrowthPct: 36,
    epsSurprisePct: 6.4,
    guidance: "raised",
    epsRevisionScore: 82,
    nextEarningsOffsetDays: 18,
    newsTone: 0.74,
    eventNote: "Custom AI ASIC shipments are the key watch item."
  },
  {
    ticker: "AMD",
    companyName: "Advanced Micro Devices",
    sector: "Semiconductors",
    industry: "Data Center GPU & CPU",
    themes: ["AI", "Semiconductor"],
    description: "Second-source AI compute exposure with improving server mix.",
    currentPrice: 176,
    startMultiplier: 0.61,
    baseVolume: 56_000_000,
    volumeRatioTarget: 1.24,
    marketCapBn: 289,
    averageDollarVolumeM: 8100,
    beta: 1.63,
    pe: 45,
    priceToSales: 11,
    setup: "pullback",
    revenueGrowthPct: 19,
    epsSurprisePct: 4.2,
    guidance: "raised",
    epsRevisionScore: 71,
    nextEarningsOffsetDays: 30,
    newsTone: 0.63,
    eventNote: "MI-series demand confirmation would validate the reset."
  },
  {
    ticker: "SMCI",
    companyName: "Super Micro Computer",
    sector: "Semiconductors",
    industry: "AI Server Systems",
    themes: ["AI", "Semiconductor"],
    description: "High-beta AI infrastructure supplier with event-driven gap risk.",
    currentPrice: 96,
    startMultiplier: 0.72,
    baseVolume: 18_000_000,
    volumeRatioTarget: 1.88,
    marketCapBn: 58,
    averageDollarVolumeM: 1850,
    beta: 2.22,
    pe: 24,
    priceToSales: 2.3,
    setup: "earnings",
    revenueGrowthPct: 47,
    epsSurprisePct: 8.6,
    guidance: "inline",
    epsRevisionScore: 68,
    nextEarningsOffsetDays: 5,
    newsTone: 0.38,
    eventNote: "Inventory and gross margin color will dominate the reaction."
  },
  {
    ticker: "MSFT",
    companyName: "Microsoft",
    sector: "Mega-Cap Platforms",
    industry: "Cloud Platforms",
    themes: ["AI", "Cloud"],
    description: "Megacap platform with durable AI monetization and cloud resilience.",
    currentPrice: 458,
    startMultiplier: 0.66,
    baseVolume: 20_000_000,
    volumeRatioTarget: 1.08,
    marketCapBn: 3410,
    averageDollarVolumeM: 9600,
    beta: 0.95,
    pe: 33,
    priceToSales: 13,
    setup: "watch",
    revenueGrowthPct: 18,
    epsSurprisePct: 3.9,
    guidance: "raised",
    epsRevisionScore: 77,
    nextEarningsOffsetDays: 36,
    newsTone: 0.67,
    eventNote: "Azure growth and Copilot attach rates remain the focus."
  },
  {
    ticker: "AMZN",
    companyName: "Amazon",
    sector: "Mega-Cap Platforms",
    industry: "Cloud & Consumer Internet",
    themes: ["AI", "Cloud"],
    description: "AWS re-acceleration plus retail margin leverage keeps the trend constructive.",
    currentPrice: 214,
    startMultiplier: 0.71,
    baseVolume: 36_000_000,
    volumeRatioTarget: 1.06,
    marketCapBn: 2230,
    averageDollarVolumeM: 7500,
    beta: 1.12,
    pe: 39,
    priceToSales: 3.4,
    setup: "watch",
    revenueGrowthPct: 12,
    epsSurprisePct: 5.1,
    guidance: "raised",
    epsRevisionScore: 75,
    nextEarningsOffsetDays: 40,
    newsTone: 0.61,
    eventNote: "AWS AI services demand is the next checkpoint."
  },
  {
    ticker: "META",
    companyName: "Meta Platforms",
    sector: "Mega-Cap Platforms",
    industry: "Digital Advertising",
    themes: ["AI", "Cloud"],
    description: "Ad monetization and engagement remain strong while AI capex is digestible.",
    currentPrice: 642,
    startMultiplier: 0.58,
    baseVolume: 14_000_000,
    volumeRatioTarget: 1.28,
    marketCapBn: 1650,
    averageDollarVolumeM: 8600,
    beta: 1.19,
    pe: 27,
    priceToSales: 10.2,
    setup: "breakout",
    revenueGrowthPct: 22,
    epsSurprisePct: 7.5,
    guidance: "raised",
    epsRevisionScore: 80,
    nextEarningsOffsetDays: 33,
    newsTone: 0.73,
    eventNote: "Engagement trends and ad pricing remain the clean triggers."
  },
  {
    ticker: "GOOGL",
    companyName: "Alphabet",
    sector: "Mega-Cap Platforms",
    industry: "Search & Cloud",
    themes: ["AI", "Cloud"],
    description: "Cloud margin improvement and AI product cadence offset search debate.",
    currentPrice: 195,
    startMultiplier: 0.73,
    baseVolume: 23_000_000,
    volumeRatioTarget: 1.01,
    marketCapBn: 2410,
    averageDollarVolumeM: 4200,
    beta: 1.03,
    pe: 24,
    priceToSales: 7.1,
    setup: "watch",
    revenueGrowthPct: 14,
    epsSurprisePct: 2.8,
    guidance: "inline",
    epsRevisionScore: 68,
    nextEarningsOffsetDays: 29,
    newsTone: 0.56,
    eventNote: "Cloud reacceleration matters more than AI headline volume here."
  },
  {
    ticker: "AAPL",
    companyName: "Apple",
    sector: "Mega-Cap Platforms",
    industry: "Consumer Devices",
    themes: ["AI", "Cloud"],
    description: "Services and installed base are stable, but relative momentum is still mediocre.",
    currentPrice: 231,
    startMultiplier: 0.83,
    baseVolume: 49_000_000,
    volumeRatioTarget: 0.96,
    marketCapBn: 3440,
    averageDollarVolumeM: 11900,
    beta: 1.02,
    pe: 31,
    priceToSales: 8.4,
    setup: "watch",
    revenueGrowthPct: 5,
    epsSurprisePct: 1.9,
    guidance: "inline",
    epsRevisionScore: 57,
    nextEarningsOffsetDays: 44,
    newsTone: 0.41,
    eventNote: "AI product narrative needs price confirmation before it matters."
  },
  {
    ticker: "PANW",
    companyName: "Palo Alto Networks",
    sector: "Cybersecurity",
    industry: "Security Platforms",
    themes: ["Cybersecurity"],
    description: "Platform consolidation story with improving billings visibility.",
    currentPrice: 372,
    startMultiplier: 0.68,
    baseVolume: 5_100_000,
    volumeRatioTarget: 1.23,
    marketCapBn: 123,
    averageDollarVolumeM: 1800,
    beta: 1.16,
    pe: 52,
    priceToSales: 14.1,
    setup: "pullback",
    revenueGrowthPct: 16,
    epsSurprisePct: 3.5,
    guidance: "raised",
    epsRevisionScore: 69,
    nextEarningsOffsetDays: 27,
    newsTone: 0.58,
    eventNote: "Billings reacceleration would likely unlock relative strength again."
  },
  {
    ticker: "CRWD",
    companyName: "CrowdStrike",
    sector: "Cybersecurity",
    industry: "Endpoint Security",
    themes: ["Cybersecurity"],
    description: "Best-in-class security growth with strong institutional sponsorship.",
    currentPrice: 418,
    startMultiplier: 0.54,
    baseVolume: 4_800_000,
    volumeRatioTarget: 1.34,
    marketCapBn: 102,
    averageDollarVolumeM: 1650,
    beta: 1.14,
    pe: 63,
    priceToSales: 18.5,
    setup: "breakout",
    revenueGrowthPct: 28,
    epsSurprisePct: 5.8,
    guidance: "raised",
    epsRevisionScore: 79,
    nextEarningsOffsetDays: 42,
    newsTone: 0.72,
    eventNote: "Sustained volume above the prior pivot would validate the trend."
  },
  {
    ticker: "PLTR",
    companyName: "Palantir",
    sector: "Defense",
    industry: "Defense Software",
    themes: ["AI", "Defense"],
    description: "Government and commercial AI platform demand keep it on radar, but crowding risk is real.",
    currentPrice: 41,
    startMultiplier: 0.49,
    baseVolume: 69_000_000,
    volumeRatioTarget: 1.44,
    marketCapBn: 88,
    averageDollarVolumeM: 2500,
    beta: 1.71,
    pe: 82,
    priceToSales: 24,
    setup: "watch",
    revenueGrowthPct: 24,
    epsSurprisePct: 4.6,
    guidance: "raised",
    epsRevisionScore: 73,
    nextEarningsOffsetDays: 34,
    newsTone: 0.62,
    eventNote: "Commercial pipeline conversion matters more than narrative buzz now."
  },
  {
    ticker: "VRT",
    companyName: "Vertiv",
    sector: "Power Infrastructure",
    industry: "Data Center Power",
    themes: ["Power Infrastructure", "AI"],
    description: "AI data-center power chain winner pulling back into support.",
    currentPrice: 104,
    startMultiplier: 0.52,
    baseVolume: 8_600_000,
    volumeRatioTarget: 1.31,
    marketCapBn: 39,
    averageDollarVolumeM: 860,
    beta: 1.58,
    pe: 33,
    priceToSales: 4.6,
    setup: "pullback",
    revenueGrowthPct: 19,
    epsSurprisePct: 6.1,
    guidance: "raised",
    epsRevisionScore: 78,
    nextEarningsOffsetDays: 31,
    newsTone: 0.69,
    eventNote: "Cooling demand and order backlog updates are the key tells."
  },
  {
    ticker: "ETN",
    companyName: "Eaton",
    sector: "Power Infrastructure",
    industry: "Electrical Equipment",
    themes: ["Power Infrastructure"],
    description: "Cleaner industrial leadership with grid and electrification tailwinds.",
    currentPrice: 362,
    startMultiplier: 0.64,
    baseVolume: 2_900_000,
    volumeRatioTarget: 1.19,
    marketCapBn: 145,
    averageDollarVolumeM: 980,
    beta: 1.02,
    pe: 31,
    priceToSales: 4.3,
    setup: "breakout",
    revenueGrowthPct: 11,
    epsSurprisePct: 4.1,
    guidance: "raised",
    epsRevisionScore: 76,
    nextEarningsOffsetDays: 38,
    newsTone: 0.65,
    eventNote: "Backlog quality and pricing discipline keep this one attractive."
  },
  {
    ticker: "GEV",
    companyName: "GE Vernova",
    sector: "Power Infrastructure",
    industry: "Grid & Power Systems",
    themes: ["Power Infrastructure", "Nuclear"],
    description: "Grid modernization and power equipment demand keep the medium-term trend alive.",
    currentPrice: 246,
    startMultiplier: 0.69,
    baseVolume: 4_200_000,
    volumeRatioTarget: 1.17,
    marketCapBn: 67,
    averageDollarVolumeM: 990,
    beta: 1.24,
    pe: 34,
    priceToSales: 2.8,
    setup: "watch",
    revenueGrowthPct: 9,
    epsSurprisePct: 3.2,
    guidance: "raised",
    epsRevisionScore: 70,
    nextEarningsOffsetDays: 26,
    newsTone: 0.57,
    eventNote: "Order intake and margin progression are the gating signals."
  },
  {
    ticker: "CEG",
    companyName: "Constellation Energy",
    sector: "Utilities & Nuclear",
    industry: "Nuclear Generation",
    themes: ["Nuclear", "Power Infrastructure"],
    description: "Power scarcity trade with clean exposure to nuclear baseload demand.",
    currentPrice: 236,
    startMultiplier: 0.59,
    baseVolume: 3_400_000,
    volumeRatioTarget: 1.22,
    marketCapBn: 74,
    averageDollarVolumeM: 740,
    beta: 0.94,
    pe: 27,
    priceToSales: 3.7,
    setup: "breakout",
    revenueGrowthPct: 10,
    epsSurprisePct: 4.8,
    guidance: "raised",
    epsRevisionScore: 74,
    nextEarningsOffsetDays: 28,
    newsTone: 0.66,
    eventNote: "Long-duration power contract headlines can extend the move."
  },
  {
    ticker: "RTX",
    companyName: "RTX",
    sector: "Defense",
    industry: "Defense Prime",
    themes: ["Defense"],
    description: "Defense backlog is solid, but price trend is less urgent than the leaders.",
    currentPrice: 131,
    startMultiplier: 0.78,
    baseVolume: 7_500_000,
    volumeRatioTarget: 1.05,
    marketCapBn: 176,
    averageDollarVolumeM: 860,
    beta: 0.86,
    pe: 24,
    priceToSales: 1.9,
    setup: "watch",
    revenueGrowthPct: 8,
    epsSurprisePct: 2.4,
    guidance: "raised",
    epsRevisionScore: 61,
    nextEarningsOffsetDays: 21,
    newsTone: 0.47,
    eventNote: "Program execution quality matters more than headline flow here."
  },
  {
    ticker: "LMT",
    companyName: "Lockheed Martin",
    sector: "Defense",
    industry: "Defense Prime",
    themes: ["Defense"],
    description: "Defensive relative strength, but momentum remains secondary to growth leadership.",
    currentPrice: 492,
    startMultiplier: 0.88,
    baseVolume: 1_500_000,
    volumeRatioTarget: 1.02,
    marketCapBn: 115,
    averageDollarVolumeM: 560,
    beta: 0.71,
    pe: 19,
    priceToSales: 1.7,
    setup: "watch",
    revenueGrowthPct: 5,
    epsSurprisePct: 1.6,
    guidance: "inline",
    epsRevisionScore: 56,
    nextEarningsOffsetDays: 17,
    newsTone: 0.41,
    eventNote: "Backlog quality is good, but trend acceleration is still missing."
  },
  {
    ticker: "LLY",
    companyName: "Eli Lilly",
    sector: "Healthcare",
    industry: "Biopharma",
    themes: ["Obesity Treatment"],
    description: "GLP-1 leadership remains intact, though recent digestion keeps it tactical.",
    currentPrice: 912,
    startMultiplier: 0.62,
    baseVolume: 3_800_000,
    volumeRatioTarget: 1.09,
    marketCapBn: 842,
    averageDollarVolumeM: 2900,
    beta: 0.41,
    pe: 58,
    priceToSales: 18,
    setup: "pullback",
    revenueGrowthPct: 24,
    epsSurprisePct: 5.4,
    guidance: "raised",
    epsRevisionScore: 75,
    nextEarningsOffsetDays: 35,
    newsTone: 0.61,
    eventNote: "Capacity expansion updates would help the trend reset."
  },
  {
    ticker: "TSLA",
    companyName: "Tesla",
    sector: "Consumer Discretionary",
    industry: "Electric Vehicles",
    themes: ["Robotics"],
    description: "Headline-driven tape with weak relative trend and elevated execution risk.",
    currentPrice: 182,
    startMultiplier: 1.23,
    baseVolume: 117_000_000,
    volumeRatioTarget: 1.61,
    marketCapBn: 578,
    averageDollarVolumeM: 19800,
    beta: 2.04,
    pe: 71,
    priceToSales: 5.8,
    setup: "avoid",
    revenueGrowthPct: -2,
    epsSurprisePct: -4.1,
    guidance: "cut",
    epsRevisionScore: 31,
    nextEarningsOffsetDays: 9,
    newsTone: -0.42,
    eventNote: "Margin pressure and headline volatility keep the risk profile poor."
  }
];

const sectorFixtures: SectorPerformance[] = [
  {
    sector: "Semiconductors",
    etf: "SOXX",
    performance5dPct: 6.4,
    performance20dPct: 14.1,
    performance60dPct: 29.8,
    relativeStrength: 1.23,
    score: 88,
    drivers: ["AI capex", "tight supply", "positive revisions"]
  },
  {
    sector: "Power Infrastructure",
    etf: "GRID",
    performance5dPct: 5.1,
    performance20dPct: 11.2,
    performance60dPct: 24.4,
    relativeStrength: 1.17,
    score: 82,
    drivers: ["data center demand", "electrification backlog"]
  },
  {
    sector: "Utilities & Nuclear",
    etf: "XLU",
    performance5dPct: 3.7,
    performance20dPct: 8.8,
    performance60dPct: 19.6,
    relativeStrength: 1.09,
    score: 74,
    drivers: ["power scarcity", "long-duration contracts"]
  },
  {
    sector: "Cybersecurity",
    etf: "HACK",
    performance5dPct: 4.6,
    performance20dPct: 9.8,
    performance60dPct: 18.2,
    relativeStrength: 1.12,
    score: 78,
    drivers: ["platform consolidation", "security budgets remain durable"]
  },
  {
    sector: "Mega-Cap Platforms",
    etf: "QQQ",
    performance5dPct: 2.9,
    performance20dPct: 7.4,
    performance60dPct: 16.7,
    relativeStrength: 1.06,
    score: 73,
    drivers: ["AI monetization", "balance sheet quality"]
  },
  {
    sector: "Defense",
    etf: "ITA",
    performance5dPct: 1.5,
    performance20dPct: 4.2,
    performance60dPct: 11.1,
    relativeStrength: 1.01,
    score: 64,
    drivers: ["budget resilience", "backlog visibility"]
  },
  {
    sector: "Healthcare",
    etf: "XLV",
    performance5dPct: 2.1,
    performance20dPct: 5.1,
    performance60dPct: 9.7,
    relativeStrength: 0.99,
    score: 61,
    drivers: ["GLP-1 demand", "defensive balance"]
  },
  {
    sector: "Consumer Discretionary",
    etf: "XLY",
    performance5dPct: -1.4,
    performance20dPct: -3.8,
    performance60dPct: 2.6,
    relativeStrength: 0.84,
    score: 41,
    drivers: ["rate sensitivity", "mixed demand"]
  }
];

const themeFixtures: ThemeSnapshot[] = [
  {
    name: "AI",
    newsMentions: 126,
    sentimentScore: 84,
    priceMomentumScore: 92,
    score: 91,
    linkedTickers: ["NVDA", "AVGO", "AMD", "MSFT", "META", "AMZN", "PLTR", "VRT"],
    summary: "Capex-driven AI leadership remains the dominant tape driver."
  },
  {
    name: "Semiconductor",
    newsMentions: 98,
    sentimentScore: 79,
    priceMomentumScore: 90,
    score: 87,
    linkedTickers: ["NVDA", "AVGO", "AMD", "SMCI"],
    summary: "Chip leadership is broad enough that second-tier names still matter."
  },
  {
    name: "Power Infrastructure",
    newsMentions: 74,
    sentimentScore: 77,
    priceMomentumScore: 86,
    score: 83,
    linkedTickers: ["VRT", "ETN", "GEV", "CEG"],
    summary: "Grid and data-center power bottlenecks keep this theme durable."
  },
  {
    name: "Cloud",
    newsMentions: 66,
    sentimentScore: 71,
    priceMomentumScore: 74,
    score: 76,
    linkedTickers: ["MSFT", "AMZN", "GOOGL", "META"],
    summary: "Cloud AI monetization is helping quality platforms re-rate."
  },
  {
    name: "Cybersecurity",
    newsMentions: 44,
    sentimentScore: 73,
    priceMomentumScore: 75,
    score: 74,
    linkedTickers: ["PANW", "CRWD"],
    summary: "Security spend is holding up, supporting premium software leaders."
  },
  {
    name: "Defense",
    newsMentions: 39,
    sentimentScore: 63,
    priceMomentumScore: 58,
    score: 64,
    linkedTickers: ["RTX", "LMT", "PLTR"],
    summary: "Stable but not the tape's top urgency bucket."
  },
  {
    name: "Nuclear",
    newsMentions: 32,
    sentimentScore: 69,
    priceMomentumScore: 71,
    score: 68,
    linkedTickers: ["CEG", "GEV"],
    summary: "Power scarcity keeps nuclear interest constructive."
  },
  {
    name: "Obesity Treatment",
    newsMentions: 29,
    sentimentScore: 66,
    priceMomentumScore: 62,
    score: 63,
    linkedTickers: ["LLY"],
    summary: "Fundamentals are still strong, but price action is digesting."
  },
  {
    name: "Robotics",
    newsMentions: 21,
    sentimentScore: 43,
    priceMomentumScore: 39,
    score: 40,
    linkedTickers: ["TSLA"],
    summary: "Narrative interest exists, but price confirmation is missing."
  }
];

const marketNewsFixtures: NewsItem[] = [
  {
    id: "market-1",
    title: "Hyperscaler capex commentary keeps AI infrastructure complex bid",
    source: "MockWire",
    publishedAt: getDateOffset(-1),
    sentimentScore: 0.81,
    importanceScore: 0.92,
    tickers: ["NVDA", "AVGO", "VRT", "ETN"],
    sector: "Cross-Market",
    summary: "Cloud capex guidance stayed firm, reinforcing semis and power names."
  },
  {
    id: "market-2",
    title: "Upcoming CPI and FOMC minutes keep macro risk elevated for chase entries",
    source: "MacroScope",
    publishedAt: getDateOffset(-1),
    sentimentScore: -0.11,
    importanceScore: 0.76,
    tickers: [],
    sector: "Macro",
    summary: "Macro calendar is not bearish on its own, but it raises position sizing discipline."
  },
  {
    id: "market-3",
    title: "Security software spend remains resilient in enterprise checks",
    source: "ChannelTrack",
    publishedAt: getDateOffset(-2),
    sentimentScore: 0.58,
    importanceScore: 0.7,
    tickers: ["PANW", "CRWD"],
    sector: "Cybersecurity",
    summary: "Checks suggest consolidation winners continue to take share."
  },
  {
    id: "market-4",
    title: "Power scarcity narrative expands beyond utilities into data-center supply chain",
    source: "InfraDesk",
    publishedAt: getDateOffset(-2),
    sentimentScore: 0.74,
    importanceScore: 0.78,
    tickers: ["VRT", "ETN", "GEV", "CEG"],
    sector: "Power Infrastructure",
    summary: "Demand for equipment and generation remains above prior expectations."
  }
];

const patterns: Record<SetupProfile, number[]> = {
  breakout: [0.88, 0.88, 0.89, 0.89, 0.9, 0.9, 0.91, 0.92, 0.92, 0.93, 0.93, 0.94, 0.95, 0.95, 0.96, 0.96, 0.97, 0.97, 0.98, 0.98, 0.99, 0.99, 0.985, 0.99, 0.995, 0.99, 0.996, 0.998, 0.999, 1],
  pullback: [1.02, 1.02, 1.01, 1.01, 0.99, 0.98, 0.97, 0.96, 0.95, 0.94, 0.93, 0.935, 0.94, 0.945, 0.95, 0.955, 0.96, 0.965, 0.97, 0.975, 0.98, 0.982, 0.985, 0.988, 0.99, 0.992, 0.994, 0.996, 0.998, 1],
  watch: [0.96, 0.962, 0.963, 0.964, 0.966, 0.968, 0.969, 0.97, 0.971, 0.972, 0.973, 0.974, 0.975, 0.976, 0.977, 0.978, 0.979, 0.98, 0.982, 0.983, 0.984, 0.985, 0.986, 0.988, 0.989, 0.99, 0.992, 0.994, 0.996, 1],
  earnings: [0.93, 0.931, 0.934, 0.936, 0.939, 0.941, 0.945, 0.947, 0.95, 0.952, 0.956, 0.958, 0.96, 0.962, 0.965, 0.966, 0.968, 0.969, 0.971, 0.972, 0.974, 0.976, 0.978, 0.981, 0.984, 0.987, 0.99, 0.993, 0.997, 1],
  avoid: [1.14, 1.135, 1.13, 1.12, 1.11, 1.1, 1.09, 1.08, 1.07, 1.06, 1.05, 1.045, 1.04, 1.035, 1.03, 1.028, 1.025, 1.022, 1.02, 1.018, 1.015, 1.012, 1.01, 1.008, 1.006, 1.004, 1.003, 1.002, 1.001, 1]
};

function generatePriceHistory(seed: StockSeed): PricePoint[] {
  const recentPattern = patterns[seed.setup];
  const prefixLength = 230;
  const history: PricePoint[] = [];
  const prefixTarget = seed.currentPrice * recentPattern[0];
  const start = seed.currentPrice * seed.startMultiplier;

  for (let index = 0; index < prefixLength; index += 1) {
    const progress = index / (prefixLength - 1);
    const base = start + (prefixTarget - start) * progress;
    const wave = Math.sin(index / 12 + seed.currentPrice / 100) * 0.015;
    const noise = (pseudoRandom(`${seed.ticker}-${index}`) - 0.5) * 0.02;
    const close = Number((base * (1 + wave + noise)).toFixed(2));
    const volume = Math.round(seed.baseVolume * (0.92 + pseudoRandom(`${seed.ticker}-v-${index}`) * 0.14));
    history.push({
      date: getDateOffset(-(259 - index)),
      close,
      volume
    });
  }

  recentPattern.forEach((multiplier, index) => {
    const jitter = (pseudoRandom(`${seed.ticker}-recent-${index}`) - 0.5) * 0.008;
    const close = Number((seed.currentPrice * multiplier * (1 + jitter)).toFixed(2));
    const burst = index > 24 ? seed.volumeRatioTarget : 1;
    const volume = Math.round(seed.baseVolume * (0.94 + pseudoRandom(`${seed.ticker}-recent-v-${index}`) * 0.12) * burst);
    history.push({
      date: getDateOffset(-(29 - index)),
      close: index === recentPattern.length - 1 ? seed.currentPrice : close,
      volume
    });
  });

  return history;
}

function buildStockNews(seed: StockSeed): NewsItem[] {
  const toneWord = seed.newsTone > 0.6 ? "supports" : seed.newsTone < 0 ? "pressures" : "keeps focus on";
  return [
    {
      id: `${seed.ticker}-news-1`,
      title: `${seed.companyName} setup ${toneWord} ${seed.themes[0]} trade`,
      source: "ResearchFlow",
      publishedAt: getDateOffset(-1),
      sentimentScore: seed.newsTone,
      importanceScore: 0.74,
      tickers: [seed.ticker],
      sector: seed.sector,
      summary: `${seed.companyName} remains connected to ${seed.themes.join(" and ")} leadership. ${seed.eventNote}`
    },
    {
      id: `${seed.ticker}-news-2`,
      title: `${seed.companyName} latest checks keep investors focused on next catalyst`,
      source: "StreetPulse",
      publishedAt: getDateOffset(-3),
      sentimentScore: seed.newsTone * 0.8,
      importanceScore: 0.61,
      tickers: [seed.ticker],
      sector: seed.sector,
      summary: `${seed.description} ${seed.eventNote}`
    }
  ];
}

function buildEvents(seed: StockSeed): StockEvent[] {
  return [
    {
      id: `${seed.ticker}-earnings`,
      title: "Quarterly earnings",
      date: getDateOffset(seed.nextEarningsOffsetDays),
      category: "earnings",
      note: seed.eventNote
    },
    {
      id: `${seed.ticker}-check`,
      title: `${seed.themes[0]} checkpoint`,
      date: getDateOffset(seed.nextEarningsOffsetDays - 6),
      category: seed.themes[0] === "Defense" ? "regulatory" : "product",
      note: `Watch whether ${seed.themes[0]} interest translates into price confirmation.`
    }
  ];
}

function buildSnapshot(seed: StockSeed): StockSnapshot {
  const priceHistory = generatePriceHistory(seed);
  const closes = priceHistory.map((point) => point.close);
  const last = closes.at(-1) ?? seed.currentPrice;
  const lastWeek = closes.at(-6) ?? last;
  const lastMonth = closes.at(-21) ?? last;
  const lastQuarter = closes.at(-61) ?? last;
  const recentMax = Math.max(...closes.slice(-30));
  const high52w = Math.max(...closes);
  const low52w = Math.min(...closes);
  const avgRecentVolume = average(priceHistory.slice(-20).map((point) => point.volume));
  const dayReturns = closes.slice(1).map((value, index) => Math.abs((value - closes[index]) / closes[index]));

  return {
    profile: {
      ticker: seed.ticker,
      companyName: seed.companyName,
      sector: seed.sector,
      industry: seed.industry,
      themes: seed.themes,
      description: seed.description
    },
    quote: {
      ticker: seed.ticker,
      price: last,
      change1dPct: ((last - (closes.at(-2) ?? last)) / (closes.at(-2) ?? last)) * 100,
      change5dPct: ((last - lastWeek) / lastWeek) * 100,
      change20dPct: ((last - lastMonth) / lastMonth) * 100,
      change60dPct: ((last - lastQuarter) / lastQuarter) * 100,
      volume: priceHistory.at(-1)?.volume ?? seed.baseVolume
    },
    fundamentals: {
      marketCapBn: seed.marketCapBn,
      averageDollarVolumeM: seed.averageDollarVolumeM,
      beta: seed.beta,
      pe: seed.pe,
      priceToSales: seed.priceToSales
    },
    technicals: {
      ma20: movingAverage(closes, 20),
      ma50: movingAverage(closes, 50),
      ma200: movingAverage(closes, 200),
      high52w,
      low52w,
      relativeStrengthLine: ((last - lastQuarter) / lastQuarter) * 100 - 12.5,
      volumeRatio: (priceHistory.at(-1)?.volume ?? avgRecentVolume) / avgRecentVolume,
      atrPct: average(dayReturns.slice(-14)) * 160,
      distanceFromHighPct: ((high52w - last) / high52w) * 100,
      pullbackDepthPct: ((recentMax - last) / recentMax) * 100
    },
    earnings: {
      lastReportDate: getDateOffset(-32),
      nextEarningsDate: getDateOffset(seed.nextEarningsOffsetDays),
      revenueGrowthPct: seed.revenueGrowthPct,
      epsSurprisePct: seed.epsSurprisePct,
      guidance: seed.guidance,
      epsRevisionScore: seed.epsRevisionScore,
      summary: `${seed.guidance === "raised" ? "Raised" : seed.guidance === "cut" ? "Cut" : "Held"} guidance after ${seed.epsSurprisePct.toFixed(1)}% EPS surprise.`
    },
    priceHistory,
    recentNews: buildStockNews(seed),
    eventCalendar: buildEvents(seed)
  };
}

const stockSnapshots = stockSeeds.map(buildSnapshot);
const snapshotMap = new Map(stockSnapshots.map((stock) => [stock.profile.ticker, stock]));

export function getMockStockSnapshots(tickers: string[]): StockSnapshot[] {
  return tickers
    .map((ticker) => snapshotMap.get(ticker))
    .filter((stock): stock is StockSnapshot => Boolean(stock));
}

export function getAllMockStockSnapshots(): StockSnapshot[] {
  return stockSnapshots;
}

export function getMockSectorPerformance(): SectorPerformance[] {
  return sectorFixtures;
}

export function getMockThemeSnapshots(): ThemeSnapshot[] {
  return themeFixtures;
}

export function getMockMarketNews(): NewsItem[] {
  return marketNewsFixtures;
}

export function getMockEconomicEvents(): EconomicEvent[] {
  return [
    {
      id: "event-cpi",
      title: "US CPI",
      date: getDateOffset(1),
      impact: "high",
      note: "Growth leadership can wobble on hot inflation prints."
    },
    {
      id: "event-fomc",
      title: "FOMC Minutes",
      date: getDateOffset(3),
      impact: "high",
      note: "Watch rate-path language before adding extended names."
    },
    {
      id: "event-nfp",
      title: "Nonfarm Payrolls",
      date: getDateOffset(5),
      impact: "medium",
      note: "Labor surprise can influence yields and dollar direction."
    }
  ];
}

export function getMockMacroSnapshot(): Omit<{ asOf: string; regime: "risk-on"; indices: InstrumentSnapshot[]; macroAssets: InstrumentSnapshot[]; economicEvents: EconomicEvent[] }, never> {
  return {
    asOf: new Date().toISOString(),
    regime: "risk-on",
    indices: [
      { symbol: "SPX", name: "S&P 500", value: 5284, change1dPct: 0.7, change5dPct: 1.9, trend: "up" },
      { symbol: "NDX", name: "Nasdaq 100", value: 18860, change1dPct: 1.2, change5dPct: 3.4, trend: "up" },
      { symbol: "RUT", name: "Russell 2000", value: 2136, change1dPct: 0.2, change5dPct: 0.6, trend: "flat" }
    ],
    macroAssets: [
      { symbol: "VIX", name: "VIX", value: 14.8, change1dPct: -4.2, change5dPct: -8.1, trend: "down" },
      { symbol: "US2Y", name: "UST 2Y", value: 4.11, change1dPct: -1.3, change5dPct: -2.1, trend: "down" },
      { symbol: "US10Y", name: "UST 10Y", value: 3.91, change1dPct: -0.7, change5dPct: -1.4, trend: "down" },
      { symbol: "DXY", name: "DXY", value: 102.4, change1dPct: -0.4, change5dPct: -0.8, trend: "down" },
      { symbol: "WTI", name: "WTI", value: 79.6, change1dPct: 0.9, change5dPct: 2.7, trend: "up" },
      { symbol: "XAU", name: "Gold", value: 2178, change1dPct: 0.3, change5dPct: 1.2, trend: "up" }
    ],
    economicEvents: getMockEconomicEvents()
  };
}
