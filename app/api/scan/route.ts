import { NextRequest, NextResponse } from "next/server";
import { getOvernightDashboardData } from "@/services/overnight-research-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ data: getOvernightDashboardData() });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => ({}))) as { settings?: Record<string, unknown> };
  return NextResponse.json({ data: getOvernightDashboardData(payload.settings) });
}
