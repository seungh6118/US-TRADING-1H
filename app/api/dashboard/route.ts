import { NextRequest, NextResponse } from "next/server";
import { isLiveDataUnavailableError } from "@/lib/errors";
import { DashboardData, UniverseKey } from "@/lib/types";
import { getDashboardData } from "@/services/research-service";

export const dynamic = "force-dynamic";

type CacheEntry = {
  expiresAt: number;
  data: DashboardData;
};

const dashboardRouteGlobals = globalThis as typeof globalThis & {
  __dashboardRouteCache?: Map<string, CacheEntry>;
};

const dashboardCache = dashboardRouteGlobals.__dashboardRouteCache ?? (dashboardRouteGlobals.__dashboardRouteCache = new Map<string, CacheEntry>());

function buildCacheKey(universe: UniverseKey, custom: string[]) {
  return `${universe}:${custom.join(",")}`;
}

export async function GET(request: NextRequest) {
  try {
    const universe = (request.nextUrl.searchParams.get("universe") ?? "sp500") as UniverseKey;
    const custom =
      request.nextUrl.searchParams
        .get("custom")
        ?.split(",")
        .map((ticker) => ticker.trim().toUpperCase())
        .filter(Boolean) ?? [];

    const cacheKey = buildCacheKey(universe, custom);
    const cached = dashboardCache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return NextResponse.json(
        { data: cached.data },
        { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" } }
      );
    }

    const data = await getDashboardData(universe, custom);
    dashboardCache.set(cacheKey, {
      data,
      expiresAt: now + 5 * 60 * 1000
    });

    return NextResponse.json(
      { data },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=300" } }
    );
  } catch (error) {
    if (isLiveDataUnavailableError(error)) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error" },
      { status: 500 }
    );
  }
}
