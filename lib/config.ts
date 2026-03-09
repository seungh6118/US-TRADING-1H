import { AppMode, DashboardFilters, UniverseKey } from "@/lib/types";

export const scoreWeights = {
  macroFit: 0.15,
  sectorStrength: 0.2,
  themeStrength: 0.15,
  earningsNews: 0.15,
  priceStructure: 0.2,
  flowVolume: 0.1,
  valuationSanity: 0.05
} as const;

export const appConfig = {
  requestedMode: (process.env.APP_DATA_MODE ?? "mock") as AppMode,
  defaultUniverse: (process.env.APP_DEFAULT_UNIVERSE ?? "sp500") as UniverseKey,
  timezone: process.env.APP_TIMEZONE ?? "Asia/Seoul",
  customTickers:
    process.env.APP_CUSTOM_TICKERS?.split(",")
      .map((ticker) => ticker.trim().toUpperCase())
      .filter(Boolean) ?? []
};

export const defaultFilters: DashboardFilters = {
  marketCapMinBn: 10,
  averageDollarVolumeMinM: 50,
  sector: "All",
  volatilityMaxPct: 8,
  excludeEarningsWindow: false
};

export const riskWindows = {
  earningsDays: 7,
  highVolatilityAtrPct: 6.5,
  overextended20dPct: 18
};

export const dbConfig = {
  envPathKey: "APP_DB_PATH",
  fallbackRelativePath: "db/data/stock-research.sqlite"
};