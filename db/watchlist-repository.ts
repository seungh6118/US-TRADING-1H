import { getDbState, saveDbState } from "@/db/client";
import { SavedWatchlistItem, WatchlistSnapshotItem } from "@/lib/types";

type SnapshotRecord = WatchlistSnapshotItem & { universe: string };

export function getSavedWatchlist(): SavedWatchlistItem[] {
  return [...getDbState().savedWatchlist].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function toggleSavedWatchlist(ticker: string): SavedWatchlistItem[] {
  const state = getDbState();
  const existing = state.savedWatchlist.find((item) => item.ticker === ticker);
  const nextState = {
    ...state,
    savedWatchlist: existing
      ? state.savedWatchlist.filter((item) => item.ticker !== ticker)
      : [...state.savedWatchlist, { ticker, note: null, createdAt: new Date().toISOString() }]
  };

  saveDbState(nextState);
  return getSavedWatchlist();
}

export function snapshotExists(snapshotDate: string, universe: string): boolean {
  return getDbState().snapshots.some((item) => item.date === snapshotDate && item.universe === universe);
}

export function saveSnapshot(snapshotDate: string, universe: string, items: WatchlistSnapshotItem[]): void {
  const state = getDbState();
  const filtered = state.snapshots.filter((item) => !(item.date === snapshotDate && item.universe === universe));
  const records: SnapshotRecord[] = items.map((item) => ({ ...item, universe, date: snapshotDate }));
  saveDbState({
    ...state,
    snapshots: [...filtered, ...records]
  });
}

export function getLatestSnapshotDates(universe: string, limit = 2): string[] {
  return Array.from(new Set(getDbState().snapshots.filter((item) => item.universe === universe).map((item) => item.date)))
    .sort((left, right) => right.localeCompare(left))
    .slice(0, limit);
}

export function getSnapshot(snapshotDate: string, universe: string): WatchlistSnapshotItem[] {
  return getDbState().snapshots
    .filter((item) => item.date === snapshotDate && item.universe === universe)
    .sort((left, right) => right.score - left.score)
    .map((item) => ({
      ticker: item.ticker,
      companyName: item.companyName,
      date: item.date,
      score: item.score,
      label: item.label,
      reason: item.reason,
      keyLevel: item.keyLevel,
      invalidation: item.invalidation,
      nextCheckpoint: item.nextCheckpoint,
      deltaFromPrior: item.deltaFromPrior,
      isNew: item.isNew
    }));
}