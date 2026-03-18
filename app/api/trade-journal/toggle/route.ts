import { NextRequest, NextResponse } from "next/server";
import { OvernightCandidate } from "@/lib/overnight-types";
import { normalizeSyncKey } from "@/lib/overnight-sync";
import { toIsoDateInTimezone } from "@/lib/utils";
import { overnightRuntime } from "@/lib/overnight-runtime";
import { toggleOvernightTradeJournalEntry } from "@/services/overnight-trade-journal-service";

export const dynamic = "force-dynamic";

type Payload = {
  sessionDate?: string;
  syncKey?: string;
  candidate?: OvernightCandidate;
  source?: "close-pick" | "afterhours-radar";
};

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => ({}))) as Payload;
  if (!payload.candidate || !payload.sessionDate || !payload.source) {
    return NextResponse.json({ error: "기록할 종목 정보가 부족합니다." }, { status: 400 });
  }

  const currentSessionDate = toIsoDateInTimezone(new Date(), overnightRuntime.marketTimezone);
  const tradeJournal = await toggleOvernightTradeJournalEntry(
    payload.sessionDate,
    normalizeSyncKey(payload.syncKey) || null,
    payload.candidate,
    payload.source,
    currentSessionDate
  );

  return NextResponse.json({ tradeJournal });
}
