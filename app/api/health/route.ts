import { NextResponse } from "next/server";
import { getDbInfo, getDbState } from "@/db/client";
import { getProviderSet } from "@/providers/factory";

export function GET() {
  getDbState();
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