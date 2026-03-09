import fs from "node:fs";
import path from "node:path";
import { dbConfig } from "@/lib/config";
import { SavedWatchlistItem, WatchlistSnapshotItem } from "@/lib/types";

type SnapshotRecord = WatchlistSnapshotItem & { universe: string };

type DbState = {
  savedWatchlist: SavedWatchlistItem[];
  snapshots: SnapshotRecord[];
};

declare global {
  var __stockResearchState: DbState | undefined;
  var __stockResearchStatePath: string | undefined;
}

function resolveDbPath(): string {
  const configured = process.env[dbConfig.envPathKey]?.trim();
  if (configured) {
    return path.resolve(configured);
  }

  return path.join(process.cwd(), dbConfig.fallbackRelativePath);
}

function seedState(): DbState {
  return {
    savedWatchlist: [
      { ticker: "NVDA", note: "AI 리더", createdAt: new Date().toISOString() },
      { ticker: "VRT", note: "전력 체인", createdAt: new Date().toISOString() },
      { ticker: "PANW", note: "사이버보안 리셋", createdAt: new Date().toISOString() }
    ],
    snapshots: []
  };
}

function ensureStateFile(dbPath: string): DbState {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  if (!fs.existsSync(dbPath)) {
    const state = seedState();
    fs.writeFileSync(dbPath, JSON.stringify(state, null, 2), "utf8");
    return state;
  }

  try {
    const raw = fs.readFileSync(dbPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<DbState>;
    return {
      savedWatchlist: parsed.savedWatchlist ?? seedState().savedWatchlist,
      snapshots: parsed.snapshots ?? []
    };
  } catch {
    const state = seedState();
    fs.writeFileSync(dbPath, JSON.stringify(state, null, 2), "utf8");
    return state;
  }
}

export function getDbState(): DbState {
  const dbPath = resolveDbPath();
  if (!global.__stockResearchState || global.__stockResearchStatePath !== dbPath) {
    global.__stockResearchState = ensureStateFile(dbPath);
    global.__stockResearchStatePath = dbPath;
  }

  return global.__stockResearchState;
}

export function saveDbState(state: DbState) {
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(state, null, 2), "utf8");
  global.__stockResearchState = state;
  global.__stockResearchStatePath = dbPath;
}

export function getDbInfo() {
  const pathValue = resolveDbPath();
  return {
    path: pathValue,
    persistentStorageConfigured: Boolean(process.env[dbConfig.envPathKey]?.trim())
  };
}