import { NextRequest, NextResponse } from "next/server";
import { buildCandidateBacktest, buildStoredSnapshotBacktest } from "@/services/overnight-backtest-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker");

  if (ticker) {
    const data = await buildCandidateBacktest(ticker.toUpperCase());
    return NextResponse.json({ data });
  }

  const data = await buildStoredSnapshotBacktest();
  return NextResponse.json({ data });
}
