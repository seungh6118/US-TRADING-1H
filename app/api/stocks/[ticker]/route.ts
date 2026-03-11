import { NextResponse } from "next/server";
import { getOvernightCandidateDetail } from "@/services/overnight-research-service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { ticker: string } }) {
  const candidate = await getOvernightCandidateDetail(params.ticker.toUpperCase());
  if (!candidate) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ data: candidate });
}
