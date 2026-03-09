import { NextResponse } from "next/server";
import { getDb, getDbInfo } from "@/db/client";
import { getProviderSet } from "@/providers/factory";

export function GET() {
  getDb();
  const providers = getProviderSet();
  const db = getDbInfo();

  return NextResponse.json({
    ok: true,
    requestedMode: providers.status.requestedMode,
    runtimeMode: providers.status.runtimeMode,
    persistentStorageConfigured: db.persistentStorageConfigured,
    timestamp: new Date().toISOString()
  });
}