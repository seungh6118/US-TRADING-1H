import { getDbState, saveDbState } from "@/db/client";
import { StoredOvernightTradeJournalEntry } from "@/lib/overnight-types";
import { normalizeSyncKey } from "@/lib/overnight-sync";

export function listOvernightTradeJournalEntries(limit = 24, syncKey?: string | null): StoredOvernightTradeJournalEntry[] {
  const normalizedSyncKey = normalizeSyncKey(syncKey) || null;
  return [...getDbState().overnightTradeJournalEntries]
    .filter((entry) => (normalizedSyncKey ? entry.syncKey === normalizedSyncKey : entry.syncKey == null))
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
    .slice(0, limit);
}

export function findOvernightTradeJournalEntry(sessionDate: string, ticker: string, syncKey?: string | null) {
  const normalizedSyncKey = normalizeSyncKey(syncKey) || null;
  return getDbState().overnightTradeJournalEntries.find(
    (entry) => entry.sessionDate === sessionDate && entry.ticker === ticker && entry.syncKey === normalizedSyncKey
  );
}

export function upsertOvernightTradeJournalEntry(entry: StoredOvernightTradeJournalEntry): void {
  const state = getDbState();
  const normalizedEntry: StoredOvernightTradeJournalEntry = {
    ...entry,
    syncKey: normalizeSyncKey(entry.syncKey) || null
  };
  const filtered = state.overnightTradeJournalEntries.filter((item) => item.id !== normalizedEntry.id);

  saveDbState({
    ...state,
    overnightTradeJournalEntries: [...filtered, normalizedEntry].sort((left, right) =>
      right.recordedAt.localeCompare(left.recordedAt)
    )
  });
}

export function removeOvernightTradeJournalEntry(entryId: string): void {
  const state = getDbState();
  saveDbState({
    ...state,
    overnightTradeJournalEntries: state.overnightTradeJournalEntries.filter((entry) => entry.id !== entryId)
  });
}
