import { getDb } from "@/db/client";
import { SavedWatchlistItem, WatchlistSnapshotItem } from "@/lib/types";

type SnapshotRow = Omit<WatchlistSnapshotItem, "isNew"> & { isNew: number };

export function getSavedWatchlist(): SavedWatchlistItem[] {
  const db = getDb();
  return db
    .prepare("SELECT ticker, note, created_at as createdAt FROM saved_watchlist ORDER BY created_at ASC")
    .all() as SavedWatchlistItem[];
}

export function toggleSavedWatchlist(ticker: string): SavedWatchlistItem[] {
  const db = getDb();
  const existing = db.prepare("SELECT ticker FROM saved_watchlist WHERE ticker = ?").get(ticker);
  if (existing) {
    db.prepare("DELETE FROM saved_watchlist WHERE ticker = ?").run(ticker);
  } else {
    db.prepare("INSERT INTO saved_watchlist (ticker, note, created_at) VALUES (?, ?, ?)").run(
      ticker,
      null,
      new Date().toISOString()
    );
  }
  return getSavedWatchlist();
}

export function snapshotExists(snapshotDate: string, universe: string): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) as count FROM watchlist_snapshots WHERE snapshot_date = ? AND universe = ?")
    .get(snapshotDate, universe) as { count: number };
  return row.count > 0;
}

export function saveSnapshot(snapshotDate: string, universe: string, items: WatchlistSnapshotItem[]): void {
  const db = getDb();
  const insert = db.prepare(`
    INSERT OR REPLACE INTO watchlist_snapshots (
      snapshot_date,
      universe,
      ticker,
      company_name,
      score,
      label,
      reason,
      key_level,
      invalidation,
      next_checkpoint,
      delta_from_prior,
      is_new
    ) VALUES (
      @snapshot_date,
      @universe,
      @ticker,
      @company_name,
      @score,
      @label,
      @reason,
      @key_level,
      @invalidation,
      @next_checkpoint,
      @delta_from_prior,
      @is_new
    )
  `);

  const transaction = db.transaction((rows: WatchlistSnapshotItem[]) => {
    rows.forEach((row) => {
      insert.run({
        snapshot_date: snapshotDate,
        universe,
        ticker: row.ticker,
        company_name: row.companyName,
        score: row.score,
        label: row.label,
        reason: row.reason,
        key_level: row.keyLevel,
        invalidation: row.invalidation,
        next_checkpoint: row.nextCheckpoint,
        delta_from_prior: row.deltaFromPrior,
        is_new: row.isNew ? 1 : 0
      });
    });
  });

  transaction(items);
}

export function getLatestSnapshotDates(universe: string, limit = 2): string[] {
  const db = getDb();
  return (db
    .prepare(
      "SELECT DISTINCT snapshot_date as snapshotDate FROM watchlist_snapshots WHERE universe = ? ORDER BY snapshot_date DESC LIMIT ?"
    )
    .all(universe, limit) as Array<{ snapshotDate: string }>).map((row) => row.snapshotDate);
}

export function getSnapshot(snapshotDate: string, universe: string): WatchlistSnapshotItem[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
        ticker,
        company_name as companyName,
        snapshot_date as date,
        score,
        label,
        reason,
        key_level as keyLevel,
        invalidation,
        next_checkpoint as nextCheckpoint,
        delta_from_prior as deltaFromPrior,
        is_new as isNew
      FROM watchlist_snapshots
      WHERE snapshot_date = ? AND universe = ?
      ORDER BY score DESC`
    )
    .all(snapshotDate, universe) as SnapshotRow[];

  return rows.map((row) => ({
    ticker: row.ticker,
    companyName: row.companyName,
    date: row.date,
    score: row.score,
    label: row.label,
    reason: row.reason,
    keyLevel: row.keyLevel,
    invalidation: row.invalidation,
    nextCheckpoint: row.nextCheckpoint,
    deltaFromPrior: row.deltaFromPrior,
    isNew: Boolean(row.isNew)
  }));
}
