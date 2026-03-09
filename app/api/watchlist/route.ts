import { NextResponse } from "next/server";
import { getDashboardData } from "@/services/research-service";

export async function GET() {
  const data = await getDashboardData();
  return NextResponse.json({ data: data.watchlist });
}
