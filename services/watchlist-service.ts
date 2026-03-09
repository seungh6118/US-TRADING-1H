import {
  getLatestSnapshotDates,
  getSavedWatchlist,
  getSnapshot,
  saveSnapshot,
  snapshotExists,
  toggleSavedWatchlist
} from "@/db/watchlist-repository";
import { CandidateStock, SavedWatchlistItem, WatchlistSnapshotItem, WatchlistSummary } from "@/lib/types";
import { getLocalIsoDate } from "@/lib/utils";

function isoDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildSnapshotItems(
  candidates: CandidateStock[],
  snapshotDate: string,
  previousItems: WatchlistSnapshotItem[] = []
): WatchlistSnapshotItem[] {
  const previousMap = new Map(previousItems.map((item) => [item.ticker, item]));
  return candidates.slice(0, 10).map((candidate, index) => {
    const previous = previousMap.get(candidate.profile.ticker);
    const priorScore = previous?.score ?? Math.max(35, candidate.score.finalScore - 2.2 - index * 0.45);
    return {
      ticker: candidate.profile.ticker,
      companyName: candidate.profile.companyName,
      date: snapshotDate,
      score: Number(candidate.score.finalScore.toFixed(1)),
      label: candidate.label,
      reason: candidate.narrative.whyWatch[0],
      keyLevel: candidate.keyLevels.tacticalEntry,
      invalidation: candidate.narrative.invalidation[0],
      nextCheckpoint: candidate.narrative.confirmation[0],
      deltaFromPrior: Number((candidate.score.finalScore - priorScore).toFixed(1)),
      isNew: !previous
    };
  });
}

function buildSeededPreviousItems(candidates: CandidateStock[], snapshotDate: string): WatchlistSnapshotItem[] {
  const base = candidates.slice(0, 10);
  if (candidates[10]) {
    base[base.length - 1] = candidates[10];
  }

  return base.map((candidate, index) => ({
    ticker: candidate.profile.ticker,
    companyName: candidate.profile.companyName,
    date: snapshotDate,
    score: Number(Math.max(30, candidate.score.finalScore - 2.8 - index * 0.4).toFixed(1)),
    label: candidate.label,
    reason: candidate.narrative.whyWatch[0],
    keyLevel: candidate.keyLevels.tacticalEntry,
    invalidation: candidate.narrative.invalidation[0],
    nextCheckpoint: candidate.narrative.confirmation[0],
    deltaFromPrior: 0,
    isNew: false
  }));
}

export function ensureWatchlistSnapshot(universe: string, candidates: CandidateStock[]): WatchlistSummary {
  const today = getLocalIsoDate();
  const yesterday = isoDateOffset(-1);

  if (!snapshotExists(yesterday, universe)) {
    saveSnapshot(yesterday, universe, buildSeededPreviousItems(candidates, yesterday));
  }

  const previousItems = getSnapshot(yesterday, universe);
  if (!snapshotExists(today, universe)) {
    saveSnapshot(today, universe, buildSnapshotItems(candidates, today, previousItems));
  }

  const snapshotDates = getLatestSnapshotDates(universe, 2);
  const currentDate = snapshotDates[0] ?? today;
  const priorDate = snapshotDates[1] ?? yesterday;
  const currentItems = getSnapshot(currentDate, universe);
  const priorItems = getSnapshot(priorDate, universe);
  const removedTickers = priorItems
    .map((item) => item.ticker)
    .filter((ticker) => !currentItems.some((item) => item.ticker === ticker));

  return {
    snapshotDate: currentDate,
    items: currentItems,
    removedTickers,
    saved: getSavedWatchlist()
  };
}

export function toggleWatchlistTicker(ticker: string): SavedWatchlistItem[] {
  return toggleSavedWatchlist(ticker);
}

export function getCurrentSavedWatchlist(): SavedWatchlistItem[] {
  return getSavedWatchlist();
}
