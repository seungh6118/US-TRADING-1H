import { NextRequest, NextResponse } from "next/server";
import { getOvernightDashboardData } from "@/services/overnight-research-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getOvernightDashboardData();
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => ({}))) as { settings?: Record<string, unknown> };
  const data = await getOvernightDashboardData(payload.settings);
  return NextResponse.json({ data });
}
