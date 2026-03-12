import { listOvernightSnapshots } from "@/db/overnight-snapshot-repository";
import { overnightRuntime } from "@/lib/overnight-runtime";
import {
  OvernightBacktestSummary,
  OvernightPreviousReview,
  OvernightPreviousReviewCandidate,
  OvernightStrategyBacktest,
  OvernightStrategyBacktestResult
} from "@/lib/overnight-types";
import { average, round1, toIsoDateInTimezone } from "@/lib/utils";
import { fetchYahooChartData, fetchYahooSparkBatch } from "@/providers/live/yahoo-overnight";

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

function buildPreviousOutcomeLabel(candidate: OvernightPreviousReviewCandidate) {
  if (candidate.outcome === "success") {
    return `${candidate.ticker}는 익일 장중 ${candidate.highPct >= 0 ? "+" : ""}${candidate.highPct.toFixed(1)}%까지 뻗었습니다.`;
  }
  if (candidate.outcome === "working") {
    return `${candidate.ticker}는 익일 현재 ${candidate.currentMovePct >= 0 ? "+" : ""}${candidate.currentMovePct.toFixed(1)}%로 진행 중입니다.`;
  }
  if (candidate.outcome === "failed") {
    return `${candidate.ticker}는 익일 현재 ${candidate.currentMovePct.toFixed(1)}%로 약했습니다.`;
  }
  return `${candidate.ticker}는 아직 익일 데이터가 충분히 쌓이지 않았습니다.`;
}

function buildPreviousOutcome(
  close: number,
  currentPrice: number,
  gapPct: number,
  highPct: number
): OvernightPreviousReviewCandidate["outcome"] {
  if (close <= 0 || currentPrice <= 0) {
    return "pending";
  }
  if (highPct >= 2 || gapPct >= 1) {
    return "success";
  }
  if (currentPrice >= close || highPct >= 0.7) {
    return "working";
  }
  return "failed";
}

export async function buildPreviousSnapshotReview(currentSessionDate: string): Promise<OvernightPreviousReview | null> {
  const snapshots = listOvernightSnapshots(16);
  const targetSnapshot = snapshots.find((snapshot) => snapshot.sessionDate < currentSessionDate) ?? null;
  if (!targetSnapshot) {
    return null;
  }

  const reviewTargets = targetSnapshot.candidates.slice(0, 3);
  if (reviewTargets.length === 0) {
    return null;
  }

  const tickers = reviewTargets.map((candidate) => candidate.ticker);
  const [sparkQuotes, dailyCharts] = await Promise.all([
    fetchYahooSparkBatch(tickers, "1d", "5m", true),
    Promise.all(tickers.map((ticker) => fetchYahooChartData(ticker, "6mo", "1d", false)))
  ]);

  const sparkMap = new Map(sparkQuotes.map((quote) => [quote.symbol, quote]));
  const chartMap = new Map(dailyCharts.map((chart) => [chart.symbol, chart]));

  const candidates: OvernightPreviousReviewCandidate[] = reviewTargets.map((stored) => {
    const spark = sparkMap.get(stored.ticker);
    const chart = chartMap.get(stored.ticker);
    const dailyBars =
      chart?.bars.map((bar) => ({
        date: toIsoDateInTimezone(bar.date, overnightRuntime.marketTimezone),
        open: bar.open,
        high: bar.high,
        close: bar.close
      })) ?? [];

    const signalIndex = dailyBars.findIndex((bar) => bar.date === targetSnapshot.sessionDate);
    const nextBar = signalIndex >= 0 ? dailyBars[signalIndex + 1] : null;
    const currentPrice = spark?.price ?? nextBar?.close ?? stored.close;
    const gapPct = nextBar && stored.close > 0 ? round1(((nextBar.open - stored.close) / stored.close) * 100) : 0;
    const highReference = Math.max(nextBar?.high ?? currentPrice, spark?.dayHigh ?? currentPrice);
    const highPct = stored.close > 0 ? round1(((highReference - stored.close) / stored.close) * 100) : 0;
    const currentMovePct = stored.close > 0 ? round1(((currentPrice - stored.close) / stored.close) * 100) : 0;
    const outcome = buildPreviousOutcome(stored.close, currentPrice, gapPct, highPct);

    return {
      ticker: stored.ticker,
      companyName: stored.companyName,
      close: stored.close,
      score: stored.score,
      grade: stored.grade,
      currentPrice,
      currentMovePct,
      gapPct,
      highPct,
      outcome,
      summary: buildPreviousOutcomeLabel({
        ticker: stored.ticker,
        companyName: stored.companyName,
        close: stored.close,
        score: stored.score,
        grade: stored.grade,
        currentPrice,
        currentMovePct,
        gapPct,
        highPct,
        outcome,
        summary: ""
      })
    };
  });

  const successCount = candidates.filter((candidate) => candidate.outcome === "success").length;
  const workingCount = candidates.filter((candidate) => candidate.outcome === "working").length;

  return {
    sessionDate: targetSnapshot.sessionDate,
    recordedAt: targetSnapshot.recordedAt,
    summary:
      successCount > 0
        ? `어제 종가 후보 중 ${successCount}개가 익일 장중 기준으로 성공권에 들어왔고, ${workingCount}개는 아직 진행 중입니다.`
        : workingCount > 0
          ? `어제 종가 후보는 아직 장중 진행 중인 종목이 중심입니다.`
          : `어제 종가 후보는 익일 반응이 다소 약했습니다.`,
    candidates
  };
}
