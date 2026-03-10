import { NextRequest, NextResponse } from "next/server";
import { toggleWatchlistTicker } from "@/services/watchlist-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { ticker?: string };
  if (!body.ticker) {
    return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  }

  const data = toggleWatchlistTicker(body.ticker.toUpperCase());
  return NextResponse.json({ data });
}
