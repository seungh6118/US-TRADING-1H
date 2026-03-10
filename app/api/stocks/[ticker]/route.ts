import { NextResponse } from "next/server";
import { isLiveDataUnavailableError } from "@/lib/errors";
import { getStockDetail } from "@/services/research-service";

export async function GET(_request: Request, { params }: { params: { ticker: string } }) {
  try {
    const data = await getStockDetail(params.ticker.toUpperCase());
    if (!data) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    if (isLiveDataUnavailableError(error)) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    throw error;
  }
}
