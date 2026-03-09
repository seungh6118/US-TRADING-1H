import { NextResponse } from "next/server";
import { getStockDetail } from "@/services/research-service";

export async function GET(_request: Request, { params }: { params: { ticker: string } }) {
  const data = await getStockDetail(params.ticker.toUpperCase());
  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ data });
}
