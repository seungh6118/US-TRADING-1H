import { NextRequest, NextResponse } from "next/server";
import { getDashboardData } from "@/services/research-service";
import { UniverseKey } from "@/lib/types";

export async function GET(request: NextRequest) {
  const universe = (request.nextUrl.searchParams.get("universe") ?? "sp500") as UniverseKey;
  const custom = request.nextUrl.searchParams.get("custom")?.split(",").map((ticker) => ticker.trim().toUpperCase()).filter(Boolean) ?? [];
  const data = await getDashboardData(universe, custom);
  return NextResponse.json({ data });
}
