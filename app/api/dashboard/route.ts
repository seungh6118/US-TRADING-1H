import { NextRequest, NextResponse } from "next/server";
import { isLiveDataUnavailableError } from "@/lib/errors";
import { UniverseKey } from "@/lib/types";
import { getDashboardData } from "@/services/research-service";

export async function GET(request: NextRequest) {
  try {
    const universe = (request.nextUrl.searchParams.get("universe") ?? "sp500") as UniverseKey;
    const custom = request.nextUrl.searchParams.get("custom")?.split(",").map((ticker) => ticker.trim().toUpperCase()).filter(Boolean) ?? [];
    const data = await getDashboardData(universe, custom);
    return NextResponse.json({ data });
  } catch (error) {
    if (isLiveDataUnavailableError(error)) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    throw error;
  }
}
