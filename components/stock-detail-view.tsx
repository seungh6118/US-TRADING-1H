import Link from "next/link";
import { PriceChart } from "@/components/price-chart";
import { Badge, Panel, ScoreBadge } from "@/components/ui";
import { displayCandidateLabel, displaySector } from "@/lib/localization";
import { StockDetailData } from "@/lib/types";
import { formatCurrency, formatDate, formatPercent } from "@/lib/utils";

function labelTone(label: StockDetailData["candidate"]["label"]) {
  if (label === "Avoid") {
    return "danger" as const;
  }
  if (label === "Earnings watch") {
    return "caution" as const;
  }
  return "positive" as const;
}

export function StockDetailView({ data }: { data: StockDetailData }) {
  const { candidate } = data;
  const isMock = data.status.runtimeMode === "mock";

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/" className="text-sm text-cyan-300 transition hover:text-cyan-200">
            대시보드로 돌아가기
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="info">{displaySector(candidate.profile.sector)}</Badge>
            <Badge tone={labelTone(candidate.label)}>{displayCandidateLabel(candidate.label)}</Badge>
            {isMock ? <Badge tone="danger">실시간 아님</Badge> : null}
            <ScoreBadge score={candidate.score.finalScore} />
          </div>
          <h1 className="mt-3 text-4xl text-slate-50 sm:text-5xl">
            {candidate.profile.companyName} ({candidate.profile.ticker})
          </h1>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">{candidate.profile.description}</p>
          {isMock ? (
            <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm leading-6 text-rose-100">
              이 화면의 현재가, 수익률, 52주 고점 대비, 거래량 배수는 실시간 값이 아니라 샘플 데이터입니다. 실매매 판단에는 사용하면 안 됩니다.
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="panel-muted p-3">
            <p className="label">{isMock ? "샘플 현재가" : "현재가"}</p>
            <p className="mt-1 text-xl font-semibold">{formatCurrency(candidate.quote.price)}</p>
            <p className="text-xs text-slate-400">{isMock ? "샘플 1일" : "1일"} {formatPercent(candidate.quote.change1dPct)}</p>
          </div>
          <div className="panel-muted p-3">
            <p className="label">{isMock ? "샘플 52주 고점" : "52주 고점"}</p>
            <p className="mt-1 text-xl font-semibold">{formatCurrency(candidate.technicals.high52w)}</p>
            <p className="text-xs text-slate-400">{isMock ? "샘플 기준" : "고점 대비"} {candidate.technicals.distanceFromHighPct.toFixed(1)}% 아래</p>
          </div>
          <div className="panel-muted p-3">
            <p className="label">{isMock ? "샘플 상대강도" : "상대강도"}</p>
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
        <Panel title="가격 추세와 거래량" subtitle="최근 90개 구간 기준 흐름입니다.">
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
              <p className="label">{isMock ? "샘플 거래량 배수" : "거래량 배수"}</p>
              <p className="mt-1 text-lg font-semibold">{candidate.technicals.volumeRatio.toFixed(2)}x</p>
            </div>
          </div>
        </Panel>

        <Panel title="핵심 해석" subtitle="왜 보는가, 왜 아직 아닌가, 무엇이 확인되면 유효한지 한 번에 정리합니다.">
          <div className="grid gap-3">
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4">
              <p className="label">왜 보는가</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                {candidate.narrative.whyWatch.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4">
              <p className="label">왜 아직 아닌가</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                {candidate.narrative.whyNotYet.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
              <p className="label">무엇이 확인되면 유효한가</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                {candidate.narrative.confirmation.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-rose-400/15 bg-rose-400/5 p-4">
              <p className="label">무엇이 깨지면 무효인가</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                {candidate.narrative.invalidation.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </Panel>

        <Panel title="점수 구성" subtitle="LLM이 아니라 결정론적 점수 모델로 계산한 결과입니다.">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["거시 적합도", candidate.score.macroFit, false],
              ["섹터 강도", candidate.score.sectorStrength, false],
              ["테마 적합도", candidate.score.themeStrength, false],
              ["실적 / 뉴스", candidate.score.earningsNews, false],
              ["가격 구조", candidate.score.priceStructure, false],
              ["수급 / 거래량", candidate.score.flowVolume, false],
              ["밸류에이션", candidate.score.valuationSanity, false],
              ["리스크 패널티", candidate.score.riskPenalty, true]
            ].map(([label, value, risk]) => (
              <div key={String(label)} className="panel-muted p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-300">{label}</span>
                  <span className="text-sm font-semibold text-slate-50">{Number(value).toFixed(1)}</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/6">
                  <div
                    className={`h-2 rounded-full ${risk ? "bg-gradient-to-r from-rose-300 to-rose-500" : "bg-gradient-to-r from-cyan-300 to-emerald-300"}`}
                    style={{ width: `${Math.min(Number(value), 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Bullish / Bearish / Next" subtitle="AI는 점수 설명 보강에만 사용하고, 랭킹 자체는 점수 엔진이 결정합니다.">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4">
              <p className="label">긍정 요인</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                {candidate.narrative.bullishFactors.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4">
              <p className="label">부정 요인</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                {candidate.narrative.bearishFactors.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
              <p className="label">다음 체크포인트</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                {candidate.narrative.whatToWatchNext.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </Panel>

        <Panel title="최근 뉴스" subtitle="중복을 줄이고 종목과 직접 연결된 뉴스만 보여줍니다.">
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

        <Panel title="이벤트 캘린더와 비교 종목" subtitle="가까운 촉매와 같은 섹터 후보를 함께 보여줍니다.">
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
                <Link
                  key={peer.profile.ticker}
                  href={`/stocks/${peer.profile.ticker}`}
                  className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-cyan-400/30 hover:bg-white/10"
                >
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

