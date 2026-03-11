import { OvernightDataMode } from "@/lib/overnight-types";

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const overnightRuntime = {
  mode: (process.env.OVERNIGHT_DATA_MODE ?? process.env.APP_DATA_MODE ?? "live") as OvernightDataMode,
  provider: process.env.OVERNIGHT_LIVE_PROVIDER ?? "Yahoo public feed",
  appTimezone: process.env.APP_TIMEZONE ?? "Asia/Seoul",
  marketTimezone: "America/New_York",
  maxUniverseSymbols: parseNumber(process.env.OVERNIGHT_MAX_UNIVERSE, 24),
  screenerCount: parseNumber(process.env.OVERNIGHT_SCREENER_COUNT, 10),
  cacheTtlMs: parseNumber(process.env.OVERNIGHT_CACHE_TTL_MS, 45_000),
  snapshotEnabled: process.env.OVERNIGHT_SNAPSHOT_ENABLED !== "false",
  backtestLookbackSessions: parseNumber(process.env.OVERNIGHT_BACKTEST_LOOKBACK, 20)
};
