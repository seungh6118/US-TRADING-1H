import { listOvernightSnapshots } from "@/db/overnight-snapshot-repository";
import { overnightRuntime } from "@/lib/overnight-runtime";
import {
  OvernightBacktestSummary,
  OvernightStrategyBacktest,
  OvernightStrategyBacktestResult
} from "@/lib/overnight-types";
import { average, round1, toIsoDateInTimezone } from "@/lib/utils";
import { fetchYahooChartData } from "@/providers/live/yahoo-overnight";

export function buildTradeSeriesLookback(bars: Array<{ date: string; close: number; open: number; high: number }>): OvernightBacktestSummary {
  const transitions = bars
    .slice(0, -1)
    .map((bar, index) => {
      const next = bars[index + 1];
      if (!next || bar.close <= 0) {
        return null;
      }

      const gapPct = ((next.open - bar.close) / bar.close) * 100;
      const maxGainPct = ((next.high - bar.close) / bar.close) * 100;
      const nextClosePct = ((next.close - bar.close) / bar.close) * 100;

      return {
        signalDate: bar.date,
        close: bar.close,
        nextOpen: next.open,
        nextHigh: next.high,
        nextClose: next.close,
        gapPct: round1(gapPct),
        maxGainPct: round1(maxGainPct),
        nextClosePct: round1(nextClosePct)
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const recentTrades = transitions.slice(-5).reverse();
  const gapUpRatePct = transitions.length > 0 ? (transitions.filter((trade) => trade.gapPct > 0).length / transitions.length) * 100 : 0;
  const targetHitRatePct =
    transitions.length > 0 ? (transitions.filter((trade) => trade.maxGainPct >= 2).length / transitions.length) * 100 : 0;

  return {
    lookbackSessions: overnightRuntime.backtestLookbackSessions,
    sampleSize: transitions.length,
    gapUpRatePct: round1(gapUpRatePct),
    targetHitRatePct: round1(targetHitRatePct),
    averageGapPct: round1(average(transitions.map((trade) => trade.gapPct))),
    averageMaxGainPct: round1(average(transitions.map((trade) => trade.maxGainPct))),
    averageNextClosePct: round1(average(transitions.map((trade) => trade.nextClosePct))),
    recentTrades
  };
}

export async function buildCandidateBacktest(symbol: string): Promise<OvernightBacktestSummary> {
  const daily = await fetchYahooChartData(symbol, "6mo", "1d", false);
  const bars = daily.bars
    .slice(-(overnightRuntime.backtestLookbackSessions + 1))
    .map((bar) => ({
      date: toIsoDateInTimezone(bar.date, overnightRuntime.marketTimezone),
      open: bar.open,
      high: bar.high,
      close: bar.close
    }));

  return buildTradeSeriesLookback(bars);
}

export async function buildStoredSnapshotBacktest(): Promise<OvernightStrategyBacktest | null> {
  const snapshots = listOvernightSnapshots(8);
  if (snapshots.length === 0) {
    return null;
  }

  const results: OvernightStrategyBacktestResult[] = [];

  for (const snapshot of snapshots) {
    const topPick = snapshot.candidates[0];
    if (!topPick) {
      continue;
    }

    const daily = await fetchYahooChartData(topPick.ticker, "6mo", "1d", false);
    const bars = daily.bars.map((bar) => ({
      date: toIsoDateInTimezone(bar.date, overnightRuntime.marketTimezone),
      open: bar.open,
      high: bar.high,
      close: bar.close
    }));

    const signalIndex = bars.findIndex((bar) => bar.date === snapshot.sessionDate);
    const next = signalIndex >= 0 ? bars[signalIndex + 1] : null;
    if (!next || topPick.close <= 0) {
      continue;
    }

    results.push({
      snapshotId: snapshot.id,
      sessionDate: snapshot.sessionDate,
      ticker: topPick.ticker,
      close: topPick.close,
      nextOpen: next.open,
      nextHigh: next.high,
      nextClose: next.close,
      gapPct: round1(((next.open - topPick.close) / topPick.close) * 100),
      highPct: round1(((next.high - topPick.close) / topPick.close) * 100),
      closePct: round1(((next.close - topPick.close) / topPick.close) * 100)
    });
  }

  if (results.length === 0) {
    return null;
  }

  return {
    completedTrades: results.length,
    gapWinRatePct: round1((results.filter((trade) => trade.gapPct > 0).length / results.length) * 100),
    averageGapPct: round1(average(results.map((trade) => trade.gapPct))),
    averageHighPct: round1(average(results.map((trade) => trade.highPct))),
    averageClosePct: round1(average(results.map((trade) => trade.closePct))),
    recentResults: results.slice(0, 5)
  };
}
