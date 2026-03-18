import { normalizeOvernightSettings } from "@/lib/overnight-defaults";
import { OvernightDashboardData, OvernightSettings, OvernightTradeJournal, StoredOvernightSnapshot } from "@/lib/overnight-types";
import { normalizeSyncKey } from "@/lib/overnight-sync";

export const OVERNIGHT_SNAPSHOT_STORAGE_KEY = "overnight-close-pick-history";
export const OVERNIGHT_DASHBOARD_CACHE_STORAGE_KEY = "overnight-close-dashboard-cache";

type StoredDashboardCache = {
  key: string;
  syncKey: string | null;
  savedAt: string;
  data: OvernightDashboardData;
};

function buildEmptyTradeJournal(syncKey?: string | null): OvernightTradeJournal {
  return {
    syncKey: normalizeSyncKey(syncKey) || null,
    summary: "아직 기록된 실전 테스트 종목이 없습니다.",
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

export function normalizeCachedOvernightDashboard(data: OvernightDashboardData): OvernightDashboardData {
  return {
    ...data,
    tradeJournal: data.tradeJournal ?? buildEmptyTradeJournal(data.settings?.syncKey)
  };
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadClientOvernightSnapshots(syncKey?: string): StoredOvernightSnapshot[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(OVERNIGHT_SNAPSHOT_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as StoredOvernightSnapshot[];
    const normalizedSyncKey = normalizeSyncKey(syncKey) || null;
    return Array.isArray(parsed)
      ? parsed.filter((item) => (normalizedSyncKey ? normalizeSyncKey(item.syncKey) === normalizedSyncKey : !normalizeSyncKey(item.syncKey)))
      : [];
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
  const existing = (loadAllClientOvernightSnapshots()).filter((item) => item.id !== snapshot.id);
  saveClientOvernightSnapshots(
    [...existing, snapshot].sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
  );
}

function loadAllDashboardCaches(): StoredDashboardCache[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(OVERNIGHT_DASHBOARD_CACHE_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as StoredDashboardCache[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAllDashboardCaches(entries: StoredDashboardCache[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(OVERNIGHT_DASHBOARD_CACHE_STORAGE_KEY, JSON.stringify(entries.slice(0, 12)));
}

export function buildDashboardCacheKey(settings: OvernightSettings) {
  const normalized = normalizeOvernightSettings(settings);
  return JSON.stringify({
    syncKey: normalizeSyncKey(normalized.syncKey) || null,
    minPrice: normalized.minPrice,
    minAverageVolume: normalized.minAverageVolume,
    minAverageDollarVolumeM: normalized.minAverageDollarVolumeM,
    minMarketCapBn: normalized.minMarketCapBn,
    onlyAGrade: normalized.onlyAGrade,
    excludeUpcomingEarnings: normalized.excludeUpcomingEarnings,
    allowPostMarket: normalized.allowPostMarket,
    newsWeightMultiplier: normalized.newsWeightMultiplier,
    sectorWeightMultiplier: normalized.sectorWeightMultiplier,
    weights: normalized.weights
  });
}

export function loadCachedOvernightDashboard(settings: OvernightSettings, maxAgeMs = 1000 * 60 * 60 * 12) {
  const key = buildDashboardCacheKey(settings);
  const now = Date.now();
  const match = loadAllDashboardCaches().find((entry) => entry.key === key);
  if (!match) {
    return null;
  }

  const savedAt = Date.parse(match.savedAt);
  if (!Number.isFinite(savedAt) || now - savedAt > maxAgeMs) {
    return null;
  }

  return normalizeCachedOvernightDashboard(match.data);
}

export function saveCachedOvernightDashboard(settings: OvernightSettings, data: OvernightDashboardData) {
  const nextEntry: StoredDashboardCache = {
    key: buildDashboardCacheKey(settings),
    syncKey: normalizeSyncKey(settings.syncKey) || null,
    savedAt: new Date().toISOString(),
    data: normalizeCachedOvernightDashboard(data)
  };

  const existing = loadAllDashboardCaches().filter((entry) => entry.key !== nextEntry.key);
  saveAllDashboardCaches(
    [nextEntry, ...existing].sort((left, right) => right.savedAt.localeCompare(left.savedAt))
  );
}

function loadAllClientOvernightSnapshots(): StoredOvernightSnapshot[] {
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

export function buildClientOvernightSnapshot(data: OvernightDashboardData, syncKey?: string): StoredOvernightSnapshot | null {
  if (data.topCandidates.length === 0) {
    return null;
  }

  return {
    id: `client-${normalizeSyncKey(syncKey) || "shared"}-${data.decisionState.sessionDate}-${data.generatedAt}`,
    syncKey: normalizeSyncKey(syncKey) || null,
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
