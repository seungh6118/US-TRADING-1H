import { OvernightDashboardData, StoredOvernightSnapshot } from "@/lib/overnight-types";

export const OVERNIGHT_SNAPSHOT_STORAGE_KEY = "overnight-close-pick-history";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadClientOvernightSnapshots(): StoredOvernightSnapshot[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(OVERNIGHT_SNAPSHOT_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as StoredOvernightSnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveClientOvernightSnapshots(snapshots: StoredOvernightSnapshot[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(OVERNIGHT_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshots.slice(0, 32)));
}

export function upsertClientOvernightSnapshot(snapshot: StoredOvernightSnapshot) {
  const existing = loadClientOvernightSnapshots().filter((item) => item.id !== snapshot.id);
  saveClientOvernightSnapshots(
    [...existing, snapshot].sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
  );
}

export function buildClientOvernightSnapshot(data: OvernightDashboardData): StoredOvernightSnapshot | null {
  if (data.topCandidates.length === 0) {
    return null;
  }

  return {
    id: `client-${data.decisionState.sessionDate}-${data.generatedAt}`,
    sessionDate: data.decisionState.sessionDate,
    recordedAt: data.generatedAt,
    candidates: data.topCandidates.slice(0, 10).map((candidate) => ({
      ticker: candidate.ticker,
      companyName: candidate.companyName,
      close: candidate.price,
      score: candidate.score.total,
      grade: candidate.score.grade,
      postMarketSuitability: candidate.postMarketSuitability
    }))
  };
}
