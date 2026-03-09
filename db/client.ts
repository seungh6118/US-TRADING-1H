import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { dbConfig } from "@/lib/config";

declare global {
  var __stockResearchDb: Database.Database | undefined;
}

function resolveDbPath(): string {
  const configured = process.env[dbConfig.envPathKey]?.trim();
  if (configured) {
    return path.resolve(configured);
  }

  return path.join(process.cwd(), dbConfig.fallbackRelativePath);
}

function initialize(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS saved_watchlist (
      ticker TEXT PRIMARY KEY,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS watchlist_snapshots (
      snapshot_date TEXT NOT NULL,
      universe TEXT NOT NULL,
      ticker TEXT NOT NULL,
      company_name TEXT NOT NULL,
      score REAL NOT NULL,
      label TEXT NOT NULL,
      reason TEXT NOT NULL,
      key_level REAL NOT NULL,
      invalidation TEXT NOT NULL,
      next_checkpoint TEXT NOT NULL,
      delta_from_prior REAL NOT NULL DEFAULT 0,
      is_new INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (snapshot_date, universe, ticker)
    );
  `);

  const count = database.prepare("SELECT COUNT(*) as count FROM saved_watchlist").get() as { count: number };
  if (count.count === 0) {
    const insert = database.prepare(
      "INSERT INTO saved_watchlist (ticker, note, created_at) VALUES (@ticker, @note, @created_at)"
    );
    [
      { ticker: "NVDA", note: "AI leader", created_at: new Date().toISOString() },
      { ticker: "VRT", note: "Power chain", created_at: new Date().toISOString() },
      { ticker: "PANW", note: "Cyber reset", created_at: new Date().toISOString() }
    ].forEach((row) => insert.run(row));
  }
}

export function getDb() {
  if (!global.__stockResearchDb) {
    const dbPath = resolveDbPath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const database = new Database(dbPath);
    initialize(database);
    global.__stockResearchDb = database;
  }

  return global.__stockResearchDb;
}

export function getDbInfo() {
  return {
    path: resolveDbPath(),
    persistentStorageConfigured: Boolean(process.env[dbConfig.envPathKey]?.trim())
  };
}