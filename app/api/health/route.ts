import { NextResponse } from "next/server";
import { getDbInfo, getDbState } from "@/db/client";
import { overnightRuntime } from "@/lib/overnight-runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  getDbState();
  const db = getDbInfo();

  return NextResponse.json({
    ok: true,
    requestedMode: overnightRuntime.mode,
    runtimeMode: overnightRuntime.mode,
    provider: overnightRuntime.provider,
    persistentStorageConfigured: db.persistentStorageConfigured,
    timestamp: new Date().toISOString()
  });
}
