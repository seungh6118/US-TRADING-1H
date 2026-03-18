import {
  findOvernightTradeJournalEntry,
  listOvernightTradeJournalEntries,
  removeOvernightTradeJournalEntry,
  upsertOvernightTradeJournalEntry
} from "@/db/overnight-trade-journal-repository";
import {
  OvernightCandidate,
  OvernightTradeJournal,
  OvernightTradeJournalEntry,
  OvernightGrade,
  StoredOvernightTradeJournalEntry
} from "@/lib/overnight-types";
import { normalizeSyncKey } from "@/lib/overnight-sync";
import { average, round1, toIsoDateInTimezone } from "@/lib/utils";
import { overnightRuntime } from "@/lib/overnight-runtime";
import { fetchYahooChartData, fetchYahooSparkBatch } from "@/providers/live/yahoo-overnight";

function buildTradeId(sessionDate: string, ticker: string, syncKey?: string | null) {
  return `${normalizeSyncKey(syncKey) || "shared"}-${sessionDate}-${ticker}`;
}

function getTradeOutcome(entryPrice: number, currentPrice: number, gapPct: number, highPct: number) {
  if (entryPrice <= 0 || currentPrice <= 0) {
    return "pending" as const;
  }
  if (highPct >= 2 || gapPct >= 1) {
    return "success" as const;
  }
  if (currentPrice >= entryPrice || highPct >= 0.7) {
    return "working" as const;
  }
  return "failed" as const;
}

function buildTradeSummary(entry: OvernightTradeJournalEntry) {
  if (entry.outcome === "success") {
    return `${entry.ticker}는 익일 고점 기준 ${entry.highPct >= 0 ? "+" : ""}${entry.highPct.toFixed(1)}%까지 올라갔습니다.`;
  }
  if (entry.outcome === "working") {
    return `${entry.ticker}는 현재 ${entry.currentMovePct >= 0 ? "+" : ""}${entry.currentMovePct.toFixed(1)}%로 아직 진행 중입니다.`;
  }
  if (entry.outcome === "failed") {
    return `${entry.ticker}는 익일 반응이 약했고 현재 ${entry.currentMovePct.toFixed(1)}%입니다.`;
  }
  return `${entry.ticker}는 아직 익일 결과가 완전히 확인되지 않았습니다.`;
}

async function evaluateTradeEntry(
  entry: StoredOvernightTradeJournalEntry,
  currentSessionDate: string
): Promise<OvernightTradeJournalEntry> {
  const [sparkQuotes, chart] = await Promise.all([
    fetchYahooSparkBatch([entry.ticker], "1d", "5m", true),
    fetchYahooChartData(entry.ticker, "6mo", "1d", false)
  ]);

  const spark = sparkQuotes[0];
  const dailyBars = chart.bars.map((bar) => ({
    date: toIsoDateInTimezone(bar.date, overnightRuntime.marketTimezone),
    open: bar.open,
    high: bar.high,
    close: bar.close
  }));
  const signalIndex = dailyBars.findIndex((bar) => bar.date === entry.sessionDate);
  const nextBar = signalIndex >= 0 ? dailyBars[signalIndex + 1] : null;
  const currentPrice = spark?.price ?? nextBar?.close ?? entry.entryPrice;
  const gapPct = nextBar ? round1(((nextBar.open - entry.entryPrice) / entry.entryPrice) * 100) : 0;
  const highReference = nextBar ? nextBar.high : spark?.dayHigh ?? currentPrice;
  const highPct = entry.entryPrice > 0 ? round1(((highReference - entry.entryPrice) / entry.entryPrice) * 100) : 0;
  const closePct = nextBar ? round1(((nextBar.close - entry.entryPrice) / entry.entryPrice) * 100) : 0;
  const currentMovePct = entry.entryPrice > 0 ? round1(((currentPrice - entry.entryPrice) / entry.entryPrice) * 100) : 0;
  const outcome = entry.sessionDate === currentSessionDate && !nextBar ? "pending" : getTradeOutcome(entry.entryPrice, currentPrice, gapPct, highPct);

  const resolved: OvernightTradeJournalEntry = {
    id: entry.id,
    sessionDate: entry.sessionDate,
    ticker: entry.ticker,
    companyName: entry.companyName,
    recordedAt: entry.recordedAt,
    entryPrice: entry.entryPrice,
    scoreAtEntry: entry.scoreAtEntry,
    gradeAtEntry: entry.gradeAtEntry,
    source: entry.source,
    currentPrice,
    currentMovePct,
    gapPct,
    highPct,
    closePct,
    outcome,
    summary: ""
  };

  resolved.summary = buildTradeSummary(resolved);
  return resolved;
}

export async function buildOvernightTradeJournal(currentSessionDate: string, syncKey?: string | null): Promise<OvernightTradeJournal> {
  const entries = listOvernightTradeJournalEntries(24, syncKey);
  if (entries.length === 0) {
    return {
      syncKey: normalizeSyncKey(syncKey) || null,
      summary: "아직 기록된 실전 테스트 종목이 없습니다. 오늘 실제로 들어간 종목만 기록해 두면 내일 자동 채점됩니다.",
      activeEntries: [],
      recentResults: [],
      totalTracked: 0,
      completedTrades: 0,
      successRatePct: 0,
      averageGapPct: 0,
      averageHighPct: 0,
      averageClosePct: 0
    };
  }

  const evaluated = await Promise.all(entries.map((entry) => evaluateTradeEntry(entry, currentSessionDate)));
  const activeEntries = evaluated
    .filter((entry) => entry.sessionDate === currentSessionDate || entry.outcome === "pending")
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));
  const recentResults = evaluated
    .filter((entry) => entry.sessionDate < currentSessionDate && entry.outcome !== "pending")
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
    .slice(0, 8);

  const completed = recentResults.filter((entry) => entry.outcome === "success" || entry.outcome === "working" || entry.outcome === "failed");
  const successRatePct =
    completed.length > 0 ? round1((completed.filter((entry) => entry.outcome === "success").length / completed.length) * 100) : 0;

  return {
    syncKey: normalizeSyncKey(syncKey) || null,
    summary:
      recentResults.length > 0
        ? `최근 기록 ${recentResults.length}건 중 성공 ${recentResults.filter((entry) => entry.outcome === "success").length}건, 성공률 ${successRatePct.toFixed(1)}%입니다.`
        : "오늘 기록한 종목은 내일 시가와 장중 흐름이 열리면 자동으로 결과가 채점됩니다.",
    activeEntries,
    recentResults,
    totalTracked: evaluated.length,
    completedTrades: completed.length,
    successRatePct,
    averageGapPct: round1(average(completed.map((entry) => entry.gapPct))),
    averageHighPct: round1(average(completed.map((entry) => entry.highPct))),
    averageClosePct: round1(average(completed.map((entry) => entry.closePct)))
  };
}

export function buildJournalEntryPayload(
  candidate: OvernightCandidate,
  sessionDate: string,
  syncKey: string | null | undefined,
  source: "close-pick" | "afterhours-radar"
): StoredOvernightTradeJournalEntry {
  const referencePrice =
    source === "afterhours-radar" && candidate.afterHoursChangePct !== 0
      ? round1(candidate.price * (1 + candidate.afterHoursChangePct / 100))
      : candidate.price;

  return {
    id: buildTradeId(sessionDate, candidate.ticker, syncKey),
    syncKey: normalizeSyncKey(syncKey) || null,
    sessionDate,
    ticker: candidate.ticker,
    companyName: candidate.companyName,
    recordedAt: new Date().toISOString(),
    entryPrice: referencePrice,
    scoreAtEntry: candidate.score.total,
    gradeAtEntry: candidate.score.grade as OvernightGrade,
    source
  };
}

export async function toggleOvernightTradeJournalEntry(
  sessionDate: string,
  syncKey: string | null | undefined,
  candidate: OvernightCandidate,
  source: "close-pick" | "afterhours-radar",
  currentSessionDate: string
) {
  const existing = findOvernightTradeJournalEntry(sessionDate, candidate.ticker, syncKey);
  if (existing) {
    removeOvernightTradeJournalEntry(existing.id);
  } else {
    upsertOvernightTradeJournalEntry(buildJournalEntryPayload(candidate, sessionDate, syncKey, source));
  }

  return buildOvernightTradeJournal(currentSessionDate, syncKey);
}
