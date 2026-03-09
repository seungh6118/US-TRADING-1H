import { NextRequest, NextResponse } from "next/server";
import { getDashboardData } from "@/services/research-service";

export async function GET(_request: NextRequest) {
  const data = await getDashboardData();
  const headers = new Headers({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": 'attachment; filename="watchlist-snapshot.csv"'
  });
  const rows = [
    ["날짜", "티커", "점수", "라벨", "관심 이유", "핵심 가격", "무효화 조건", "다음 체크포인트"].join(","),
    ...data.watchlist.items.map((item) =>
      [
        item.date,
        item.ticker,
        item.score.toFixed(1),
        item.label,
        `"${item.reason.replaceAll('"', '""')}"`,
        item.keyLevel.toFixed(2),
        `"${item.invalidation.replaceAll('"', '""')}"`,
        `"${item.nextCheckpoint.replaceAll('"', '""')}"`
      ].join(",")
    )
  ];
  return new NextResponse(rows.join("\n"), { headers });
}