import { NextResponse } from "next/server";
import { getDbInfo, getDbState } from "@/db/client";
import { isLiveDataUnavailableError } from "@/lib/errors";
import { getProviderSet } from "@/providers/factory";

export const dynamic = "force-dynamic";

export function GET() {
  getDbState();
  const db = getDbInfo();

  try {
    const providers = getProviderSet();
    return NextResponse.json({
      ok: true,
      requestedMode: providers.status.requestedMode,
      runtimeMode: providers.status.runtimeMode,
      persistentStorageConfigured: db.persistentStorageConfigured,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (isLiveDataUnavailableError(error)) {
      return NextResponse.json(
        {
          ok: false,
          requestedMode: "live",
          runtimeMode: "mock",
          persistentStorageConfigured: db.persistentStorageConfigured,
          error: error.message,
          timestamp: new Date().toISOString()
        },
        { status: 503 }
      );
    }

    throw error;
  }
}
