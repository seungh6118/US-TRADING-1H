import Link from "next/link";
import { PriceChart } from "@/components/price-chart";
import { Badge, Panel, ScoreBadge } from "@/components/ui";
import { displayCandidateLabel, displaySector } from "@/lib/localization";
import { StockDetailData } from "@/lib/types";
import { formatCurrency, formatDate, formatPercent } from "@/lib/utils";

export function StockDetailView({ data }: { data: StockDetailData }) {
  const { candidate } = data;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/" className="text-sm text-cyan-300 transition hover:text-cyan-200">← 대시보드로 돌아가기</Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="info">{displaySector(candidate.profile.sector)}</Badge>
            <Badge tone={candidate.label === "Avoid" ? "danger" : candidate.label === "Earnings watch" ? "caution" : "positive"}>{displayCandidateLabel(candidate.label)}</Badge>
            <ScoreBadge score={candidate.score.finalScore} />
          </div>
          <h1 className="mt-3 text-4xl text-slate-50 sm:text-5xl">{candidate.profile.companyName} ({candidate.profile.ticker})</h1>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">{candidate.profile.description}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="panel-muted p-3">
            <p className="label">현재가</p>
            <p className="mt-1 text-xl font-semibold">{formatCurrency(candidate.quote.price)}</p>
            <p className="text-xs text-slate-400">1일 {formatPercent(candidate.quote.change1dPct)}</p>
          </div>
          <div className="panel-muted p-3">
            <p className="label">52주 고점</p>
            <p className="mt-1 text-xl font-semibold">{formatCurrency(candidate.technicals.high52w)}</p>
            <p className="text-xs text-slate-400">{candidate.technicals.distanceFromHighPct.toFixed(1)}% 아래</p>
          </div>
          <div className="panel-muted p-3">
            <p className="label">상대강도</p>
            <p className="mt-1 text-xl font-semibold">{candidate.technicals.relativeStrengthLine.toFixed(1)}</p>
            <p className="text-xs text-slate-400">S&P500 대비</p>
          </div>
          <div className="panel-muted p-3">
            <p className="label">다음 실적</p>
            <p className="mt-1 text-xl font-semibold">{formatDate(candidate.earnings.nextEarningsDate)}</p>
            <p className="text-xs text-slate-400">{candidate.earnings.summary}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="가격 추세 및 거래량" subtitle="스윙 관점에서 최근 90개 세션 흐름을 확인합니다.">
          <PriceChart history={candidate.priceHistory} />
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="panel-muted p-3">
              <p className="label">20일선</p>
              <p className="mt-1 text-lg font-semibold">{formatCurrency(candidate.technicals.ma20)}</p>
            </div>
            <div className="panel-muted p-3">
              <p className="label">50일선</p>
              <p className="mt-1 text-lg font-semibold">{formatCurrency(candidate.technicals.ma50)}</p>
            </div>
            <div className="panel-muted p-3">
              <p className="label">200일선</p>
              <p className="mt-1 text-lg font-semibold">{formatCurrency(candidate.technicals.ma200)}</p>
            </div>
            <div className="panel-muted p-3">
              <p className="label">거래량 배수</p>
              <p className="mt-1 text-lg font-semibold">{candidate.technicals.volumeRatio.toFixed(2)}x</p>
            </div>
          </div>
        </Panel>

        <Panel title="리서치 포인트" subtitle="왜 보는지, 왜 아직 아닌지, 무엇이 확인되면 유효한지 한눈에 정리합니다.">
          <div className="grid gap-3">
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4">
              <p className="label">왜 보는가</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                {candidate.narrative.whyWatch.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
            <div className="rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4">
              <p className="label">왜 아직 아닌가</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                {candidate.narrative.whyNotYet.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
            <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
              <p className="label">무엇이 확인되면 유효한가</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                {candidate.narrative.confirmation.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
            <div className="rounded-2xl border border-rose-400/15 bg-rose-400/5 p-4">
              <p className="label">무엇이 깨지면 무효인가</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                {candidate.narrative.invalidation.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          </div>
        </Panel>

        <Panel title="점수 구성" subtitle="LLM이 아니라 결정론적 점수 모델로 계산합니다. 가중치는 config에서 바로 조정할 수 있습니다.">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["거시 적합도", candidate.score.macroFit],
              ["섹터 강도", candidate.score.sectorStrength],
              ["테마 적합도", candidate.score.themeStrength],
              ["실적/뉴스", candidate.score.earningsNews],
              ["가격 구조", candidate.score.priceStructure],
              ["수급/거래량", candidate.score.flowVolume],
              ["밸류에이션", candidate.score.valuationSanity],
              ["리스크 패널티", candidate.score.riskPenalty]
            ].map(([label, value]) => (
              <div key={label} className="panel-muted p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-300">{label}</span>
                  <span className="text-sm font-semibold text-slate-50">{Number(value).toFixed(1)}</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/6">
                  <div className={`h-2 rounded-full ${label === "리스크 패널티" ? "bg-gradient-to-r from-rose-300 to-rose-500" : "bg-gradient-to-r from-cyan-300 to-emerald-300"}`} style={{ width: `${Math.min(Number(value), 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="상승 / 하락 / 다음 확인" subtitle="AI는 점수 계산이 아니라 설명 보강에만 사용됩니다.">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4">
              <p className="label">상승 요인</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                {candidate.narrative.bullishFactors.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
            <div className="rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4">
              <p className="label">하락 요인</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                {candidate.narrative.bearishFactors.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
            <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
              <p className="label">다음 체크포인트</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                {candidate.narrative.whatToWatchNext.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          </div>
        </Panel>

        <Panel title="최근 뉴스" subtitle="중복을 줄인 핵심 뉴스만 종목과 다시 연결해 보여줍니다.">
          <div className="space-y-3">
            {candidate.recentNews.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-50">{item.title}</p>
                  <span className="text-xs text-slate-500">{formatDate(item.publishedAt)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{item.summary}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="이벤트 캘린더 및 동종 후보" subtitle="가까운 촉매와 같은 섹터 대안을 함께 봅니다.">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-3">
              {candidate.eventCalendar.map((event) => (
                <div key={event.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="font-medium text-slate-50">{event.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{formatDate(event.date)}</p>
                  <p className="mt-2 text-sm text-slate-300">{event.note}</p>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {data.peerCandidates.map((peer) => (
                <Link key={peer.profile.ticker} href={`/stocks/${peer.profile.ticker}`} className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-cyan-400/30 hover:bg-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-50">{peer.profile.ticker}</p>
                      <p className="text-sm text-slate-300">{peer.narrative.whyWatch[0]}</p>
                    </div>
                    <ScoreBadge score={peer.score.finalScore} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </main>
  );
}