import { getDbState, saveDbState } from "@/db/client";
import { StoredOvernightSnapshot } from "@/lib/overnight-types";
import { normalizeSyncKey } from "@/lib/overnight-sync";

export function listOvernightSnapshots(limit = 12, syncKey?: string): StoredOvernightSnapshot[] {
  const normalizedSyncKey = normalizeSyncKey(syncKey) || null;
  return [...getDbState().overnightSnapshots]
    .filter((item) => (normalizedSyncKey ? item.syncKey === normalizedSyncKey : item.syncKey == null))
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
    .slice(0, limit);
}

export function saveOvernightSnapshot(snapshot: StoredOvernightSnapshot): void {
  const state = getDbState();
  const filtered = state.overnightSnapshots.filter((item) => item.id !== snapshot.id);

  saveDbState({
    ...state,
    overnightSnapshots: [...filtered, { ...snapshot, syncKey: normalizeSyncKey(snapshot.syncKey) || null }].sort((left, right) =>
      right.recordedAt.localeCompare(left.recordedAt)
    )
  });
}

export function snapshotExists(snapshotId: string): boolean {
  return getDbState().overnightSnapshots.some((item) => item.id === snapshotId);
}
