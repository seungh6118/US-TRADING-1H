"use client";

import { AppShell, SectionCard, Tag } from "@/components/overnight-ui";

export function OvernightDashboardLoadingShell() {
  return (
    <AppShell
      title="S&P500 종가베팅 스캐너"
      subtitle="S&P500 전체를 먼저 훑고, 상위 종목만 상세 계산하는 중입니다. 첫 진입은 조금 걸릴 수 있지만 화면은 먼저 열어둡니다."
      right={
        <div className="hero-stat animate-pulse">
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="caution">스캔 준비 중</Tag>
            <Tag tone="info">S&P500 프리스캔</Tag>
          </div>
          <div className="mt-4 h-8 w-24 rounded bg-white/10" />
          <div className="mt-3 h-4 w-56 rounded bg-white/10" />
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="스캔 준비 중" subtitle="화면은 먼저 띄우고, 실제 후보는 API에서 계산해 채웁니다.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="candidate-metric animate-pulse">
                <div className="h-3 w-16 rounded bg-white/10" />
                <div className="mt-3 h-8 w-20 rounded bg-white/10" />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="오늘의 후보 계산 중" subtitle="S&P500 전체 프리스캔 후 상위 종목 상세 점수를 만들고 있습니다.">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="candidate-row animate-pulse">
                <div className="h-5 w-24 rounded bg-white/10" />
                <div className="mt-3 h-3 w-full rounded bg-white/10" />
                <div className="mt-2 h-3 w-2/3 rounded bg-white/10" />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
