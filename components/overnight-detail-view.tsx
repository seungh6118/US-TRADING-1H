import Link from "next/link";
import { OvernightCandidate, OvernightSettings } from "@/lib/overnight-types";
import { formatCompactNumber, formatCurrency, formatPercent } from "@/lib/utils";
import { AppShell, GradeBadge, ScoreBar, SectionCard, Tag } from "@/components/overnight-ui";

function sentimentTone(value: OvernightCandidate["news"][number]["sentiment"]) {
  if (value === "positive") {
    return "positive" as const;
  }
  if (value === "negative") {
    return "danger" as const;
  }
  return "neutral" as const;
}

export function OvernightDetailView({
  candidate,
  settings
}: {
  candidate: OvernightCandidate;
  settings: OvernightSettings;
}) {
  return (
    <AppShell
      title={`${candidate.ticker} 종가베팅 상세`}
      subtitle={`${candidate.companyName} 의 총점, 점수 근거, 뉴스, 장막판 수급, 익일 시나리오를 한 화면에 정리했습니다.`}
      right={
        <div className="hero-stat">
          <div className="flex flex-wrap items-center gap-2">
            <GradeBadge grade={candidate.score.grade} />
            <Tag tone={candidate.postMarketSuitability === "ideal" ? "positive" : candidate.postMarketSuitability === "allowed" ? "info" : "danger"}>
              {candidate.postMarketSuitability === "ideal"
                ? "포스트마켓 적합"
                : candidate.postMarketSuitability === "allowed"
                  ? "포스트마켓 가능"
                  : "포스트마켓 비추천"}
            </Tag>
          </div>
          <p className="mt-3 text-5xl font-semibold text-white">{candidate.score.total.toFixed(1)}</p>
          <p className="mt-2 text-sm text-slate-300">
            현재가 {formatCurrency(candidate.price)} / 당일 {formatPercent(candidate.dayChangePct)} / 애프터마켓 {formatPercent(candidate.afterHoursChangePct)}
          </p>
          <div className="mt-4">
            <Link href="/" className="subtle-action text-slate-100">
              대시보드로 돌아가기
            </Link>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="총점 구성" subtitle="블랙박스처럼 보이지 않도록 각 항목 점수를 그대로 노출합니다.">
          <div className="grid gap-3">
            <ScoreBar label="유동성" value={candidate.score.liquidity} max={settings.weights.liquidity} />
            <ScoreBar label="당일 강도" value={candidate.score.intradayStrength} max={settings.weights.intradayStrength} tone="emerald" />
            <ScoreBar label="거래량/수급" value={candidate.score.flowVolume} max={settings.weights.flowVolume} />
            <ScoreBar label="뉴스/재료/모멘텀" value={candidate.score.catalystMomentum} max={settings.weights.catalystMomentum} tone="amber" />
            <ScoreBar label="익일 실현 가능성" value={candidate.score.nextDayRealizability} max={settings.weights.nextDayRealizability} tone="rose" />
          </div>
        </SectionCard>

        <SectionCard title="핵심 수치" subtitle="체결 품질, 마감 강도, 익일 구조를 빠르게 보는 구간입니다.">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <div className="candidate-metric">
              <p className="label">거래량 / 거래대금</p>
              <p className="mt-1 text-sm font-semibold text-white">{formatCompactNumber(candidate.averageVolume)} / {candidate.averageDollarVolumeM.toFixed(0)}M</p>
            </div>
            <div className="candidate-metric">
              <p className="label">RVOL / 종가 부근 체결</p>
              <p className="mt-1 text-sm font-semibold text-white">{candidate.rvol20.toFixed(2)}x / {candidate.closeAuctionConcentration.toFixed(1)}%</p>
            </div>
            <div className="candidate-metric">
              <p className="label">VWAP / 고가 근접</p>
              <p className="mt-1 text-sm font-semibold text-white">{candidate.closeAboveVWAPPct.toFixed(1)}% / {candidate.closeToHighPct.toFixed(1)}%</p>
            </div>
            <div className="candidate-metric">
              <p className="label">저항 / 실적</p>
              <p className="mt-1 text-sm font-semibold text-white">{candidate.distanceToResistancePct.toFixed(1)}% / {candidate.daysToEarnings}일</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="추천 이유 3개" subtitle="왜 이 종목이 오늘 추천되는지 핵심만 남겼습니다.">
          <div className="space-y-3">
            {candidate.reasons.map((reason) => (
              <div key={reason} className="candidate-metric text-sm leading-6 text-slate-200">
                {reason}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="주의할 리스크 3개" subtitle="익일 갭 실패를 유발할 수 있는 요소를 먼저 봅니다.">
          <div className="space-y-3">
            {candidate.risks.map((risk) => (
              <div key={risk} className="candidate-metric text-sm leading-6 text-slate-300">
                {risk}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="오늘의 뉴스 요약" subtitle="감성 톤과 재료 분류를 함께 보여줍니다.">
          <div className="space-y-3">
            {candidate.news.map((item) => (
              <div key={item.id} className="candidate-row">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag tone={sentimentTone(item.sentiment)}>{item.sentiment}</Tag>
                  <Tag tone="neutral">{item.catalyst}</Tag>
                </div>
                <p className="mt-3 font-medium text-white">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.summary}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="장막판 수급 평가" subtitle="종가베팅에서 가장 중요한 마지막 30분 해석입니다.">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="candidate-metric">
              <p className="label">장막판 수급</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">{candidate.closeTapeNote}</p>
            </div>
            <div className="candidate-metric">
              <p className="label">익일 리스크</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{candidate.overnightRiskNote}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="익일 시나리오" subtitle="장초반 청산을 전제로 시나리오를 나눠 제시합니다.">
          <div className="grid gap-3">
            <div className="candidate-metric">
              <p className="label">시나리오 A</p>
              <p className="mt-2 text-sm leading-6 text-cyan-100">{candidate.scenario.primary}</p>
            </div>
            <div className="candidate-metric">
              <p className="label">시나리오 B</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{candidate.scenario.alternate}</p>
            </div>
            <div className="candidate-metric">
              <p className="label">청산 플랜</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">{candidate.scenario.exitPlan}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="진입 / 청산 아이디어" subtitle="장마감 직전과 익일 장초반을 나눠 생각합니다.">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="candidate-metric">
              <p className="label">진입 아이디어</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">{candidate.entryIdea}</p>
            </div>
            <div className="candidate-metric">
              <p className="label">청산 아이디어</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">{candidate.exitIdea}</p>
            </div>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
