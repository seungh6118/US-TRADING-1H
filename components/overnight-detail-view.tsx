import Link from "next/link";
import { OvernightCandidate, OvernightSettings } from "@/lib/overnight-types";
import { formatCompactNumber, formatCurrency, formatDate, formatPercent } from "@/lib/utils";
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
      subtitle={`${candidate.companyName}의 총점, 점수 근거, 오늘 뉴스, 장 막판 수급, 익일 시나리오, 과거 오버나이트 반응까지 한 화면에 정리했습니다.`}
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
            현재가 {formatCurrency(candidate.price)} / 정규장 {formatPercent(candidate.dayChangePct)} / 애프터 {formatPercent(candidate.afterHoursChangePct)}
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
        <SectionCard title="총점 구성" subtitle="추천이 블랙박스처럼 보이지 않도록 항목별 점수를 그대로 표시합니다.">
          <div className="grid gap-3">
            <ScoreBar label="유동성" value={candidate.score.liquidity} max={settings.weights.liquidity} />
            <ScoreBar label="당일 강도" value={candidate.score.intradayStrength} max={settings.weights.intradayStrength} tone="emerald" />
            <ScoreBar label="거래량/수급" value={candidate.score.flowVolume} max={settings.weights.flowVolume} />
            <ScoreBar label="뉴스/재료" value={candidate.score.catalystMomentum} max={settings.weights.catalystMomentum} tone="amber" />
            <ScoreBar label="익일 실현 가능성" value={candidate.score.nextDayRealizability} max={settings.weights.nextDayRealizability} tone="rose" />
          </div>
        </SectionCard>

        <SectionCard title="즉시 체크 숫자" subtitle="종가베팅 전 체결, 수급, 저항, 실적 리스크를 먼저 확인하는 구간입니다.">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <div className="candidate-metric">
              <p className="label">거래량 / 거래대금</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {formatCompactNumber(candidate.averageVolume)} / {candidate.averageDollarVolumeM.toFixed(0)}M
              </p>
            </div>
            <div className="candidate-metric">
              <p className="label">RVOL / 종가 체결 집중</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {candidate.rvol20.toFixed(2)}x / {candidate.closeAuctionConcentration.toFixed(1)}%
              </p>
            </div>
            <div className="candidate-metric">
              <p className="label">VWAP / 고가 근접</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {candidate.closeAboveVWAPPct.toFixed(1)}% / {candidate.closeToHighPct.toFixed(1)}%
              </p>
            </div>
            <div className="candidate-metric">
              <p className="label">실적 / 저항까지</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {candidate.daysToEarnings}일 / {candidate.distanceToResistancePct.toFixed(1)}%
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="추천 이유 3개" subtitle="왜 오늘 이 종목이 종가베팅 후보인지 숫자와 재료 중심으로 요약했습니다.">
          <div className="space-y-3">
            {candidate.reasons.map((reason) => (
              <div key={reason} className="candidate-metric text-sm leading-6 text-slate-200">
                {reason}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="주의할 리스크 3개" subtitle="익일 시나리오가 깨질 수 있는 포인트를 먼저 적었습니다.">
          <div className="space-y-3">
            {candidate.risks.map((risk) => (
              <div key={risk} className="candidate-metric text-sm leading-6 text-slate-300">
                {risk}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="오늘의 뉴스 요약" subtitle="뉴스 감성과 재료 분류를 같이 붙여서 보여줍니다.">
          <div className="space-y-3">
            {candidate.news.map((item) => (
              <a key={item.id} className="candidate-row block hover:bg-white/5" href={item.url} target="_blank" rel="noreferrer">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag tone={sentimentTone(item.sentiment)}>{item.sentiment}</Tag>
                  <Tag tone="neutral">{item.catalyst}</Tag>
                  <Tag tone="info">{item.source}</Tag>
                </div>
                <p className="mt-3 font-medium text-white">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.summary}</p>
                <p className="mt-2 text-xs text-slate-500">{formatDate(item.publishedAt)}</p>
              </a>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="장막판 수급 평가" subtitle="종가베팅에서 가장 중요한 마지막 30분 해석입니다.">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="candidate-metric">
              <p className="label">마감 테이프</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">{candidate.closeTapeNote}</p>
            </div>
            <div className="candidate-metric">
              <p className="label">익일 리스크</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{candidate.overnightRiskNote}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="익일 시나리오" subtitle="장초반 대응을 시나리오 A/B로 나눠서 정리했습니다.">
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

        <SectionCard title="진입 / 청산 아이디어" subtitle="매수와 매도 모두 종가베팅 관점으로 짧게 압축했습니다.">
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

        <SectionCard title="최근 20거래일 프록시 백테스트" subtitle="해당 종목의 최근 오버나이트 반응을 간단히 점검하는 지표입니다.">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="candidate-metric">
              <p className="label">요약</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                표본 {candidate.backtest.sampleSize}회 / 갭업 {candidate.backtest.gapUpRatePct.toFixed(1)}% / 평균 갭{" "}
                {formatPercent(candidate.backtest.averageGapPct)} / 평균 익일 고점 {formatPercent(candidate.backtest.averageMaxGainPct)}
              </p>
            </div>
            <div className="candidate-metric">
              <p className="label">2% 목표 도달</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">{candidate.backtest.targetHitRatePct.toFixed(1)}%</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {candidate.backtest.recentTrades.map((trade) => (
              <div key={`${trade.signalDate}-${trade.close}`} className="candidate-row">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-medium text-white">{trade.signalDate}</p>
                  <div className="flex flex-wrap gap-2">
                    <Tag tone={trade.gapPct >= 0 ? "positive" : "danger"}>갭 {formatPercent(trade.gapPct)}</Tag>
                    <Tag tone={trade.maxGainPct >= 2 ? "positive" : "info"}>고점 {formatPercent(trade.maxGainPct)}</Tag>
                    <Tag tone={trade.nextClosePct >= 0 ? "positive" : "danger"}>종가 {formatPercent(trade.nextClosePct)}</Tag>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  신호 종가 {formatCurrency(trade.close)} → 익일 시가 {formatCurrency(trade.nextOpen)} / 고가 {formatCurrency(trade.nextHigh)} / 종가{" "}
                  {formatCurrency(trade.nextClose)}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
