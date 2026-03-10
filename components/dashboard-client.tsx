"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { Badge, Panel, ScoreBadge } from "@/components/ui";
import { defaultFilters } from "@/lib/config";
import { universeDefinitions } from "@/lib/constants";
import {
  displayCandidateLabel,
  displayImpact,
  displayRegime,
  displayRuntimeMode,
  displaySector,
  displaySectorFilter,
  displaySeverity,
  displayTheme,
  displayUniverse
} from "@/lib/localization";
import { DashboardData, SavedWatchlistItem, UniverseKey } from "@/lib/types";
import { formatCurrency, formatDate, formatDateTime, formatPercent } from "@/lib/utils";

function regimeTone(regime: DashboardData["market"]["regime"]) {
  if (regime === "risk-on") {
    return "positive" as const;
  }
  if (regime === "risk-off") {
    return "danger" as const;
  }
  return "caution" as const;
}

function labelTone(label: DashboardData["candidates"][number]["label"]) {
  if (label === "Avoid") {
    return "danger" as const;
  }
  if (label === "Earnings watch") {
    return "caution" as const;
  }
  return "positive" as const;
}

function deltaTone(value: number) {
  if (value > 0) {
    return "text-emerald-300";
  }
  if (value < 0) {
    return "text-rose-300";
  }
  return "text-slate-300";
}

export function DashboardClient({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState(initialData);
  const [universe, setUniverse] = useState<UniverseKey>(initialData.universe);
  const [customTickerInput, setCustomTickerInput] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(defaultFilters);
  const [saved, setSaved] = useState<SavedWatchlistItem[]>(initialData.watchlist.saved);
  const [isPending, startTransition] = useTransition();
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setSaved(data.watchlist.saved);
    setUniverse(data.universe);
  }, [data]);

  const savedTickers = useMemo(() => new Set(saved.map((item) => item.ticker)), [saved]);
  const snapshotMap = useMemo(() => new Map(data.watchlist.items.map((item) => [item.ticker, item])), [data.watchlist.items]);

  const filteredCandidates = useMemo(() => {
    return data.candidates.filter((candidate) => {
      const searchPass =
        deferredSearch.trim().length === 0 ||
        candidate.profile.ticker.toLowerCase().includes(deferredSearch.toLowerCase()) ||
        candidate.profile.companyName.toLowerCase().includes(deferredSearch.toLowerCase());
      const marketCapPass = candidate.fundamentals.marketCapBn >= filters.marketCapMinBn;
      const volumePass = candidate.fundamentals.averageDollarVolumeM >= filters.averageDollarVolumeMinM;
      const sectorPass = filters.sector === "All" || candidate.profile.sector === filters.sector;
      const volatilityPass = candidate.technicals.atrPct <= filters.volatilityMaxPct;
      const earningsPass =
        !filters.excludeEarningsWindow ||
        new Date(candidate.earnings.nextEarningsDate).getTime() - Date.now() > 7 * 86400000;

      return searchPass && marketCapPass && volumePass && sectorPass && volatilityPass && earningsPass;
    });
  }, [data.candidates, deferredSearch, filters]);

  const sectorOptions = useMemo(
    () => ["All", ...Array.from(new Set(data.candidates.map((candidate) => candidate.profile.sector)))],
    [data.candidates]
  );

  const myWatchlistRows = useMemo(() => {
    return saved
      .map((item) => {
        const candidate = data.candidates.find((row) => row.profile.ticker === item.ticker);
        const snapshot = snapshotMap.get(item.ticker);
        return candidate || snapshot ? { saved: item, candidate, snapshot } : null;
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }, [data.candidates, saved, snapshotMap]);

  async function loadDashboard(nextUniverse: UniverseKey, custom = customTickerInput) {
    const params = new URLSearchParams({ universe: nextUniverse });
    if (nextUniverse === "custom" && custom.trim()) {
      params.set("custom", custom.trim());
    }

    const response = await fetch(`/api/dashboard?${params.toString()}`, { cache: "no-store" });
    const payload = (await response.json()) as { data: DashboardData };
    setData(payload.data);
  }

  function handleUniverseChange(nextUniverse: UniverseKey) {
    setUniverse(nextUniverse);
    if (nextUniverse === "custom") {
      return;
    }

    startTransition(() => {
      void loadDashboard(nextUniverse);
    });
  }

  function handleCustomUniverse() {
    startTransition(() => {
      void loadDashboard("custom", customTickerInput);
    });
  }

  function handleToggleWatchlist(ticker: string) {
    startTransition(async () => {
      const response = await fetch("/api/watchlist/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ticker })
      });
      const payload = (await response.json()) as { data: SavedWatchlistItem[] };
      setSaved(payload.data);
    });
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="info">미국주식 AI 리서치 레이더</Badge>
            <Badge tone={regimeTone(data.market.regime)}>{displayRegime(data.market.regime)}</Badge>
            <Badge tone={data.status.runtimeMode === "mock" ? "caution" : "positive"}>{displayRuntimeMode(data.status.runtimeMode)}</Badge>
            <Badge tone="neutral">{displayUniverse(data.universe)}</Badge>
          </div>
          <h1 className="max-w-3xl text-4xl text-slate-50 sm:text-5xl">한국 거주 투자자를 위한 미국 스윙 후보 압축 리서치</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            {data.status.note} 생성 시각 {formatDateTime(data.generatedAt)}. 이 앱의 목적은 지금 당장 매수 버튼을 누르게 하는 것이 아니라,
            오늘과 이번 주에 계속 봐야 할 종목을 근거 중심으로 압축하는 것입니다.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div className="panel-muted p-3">
            <p className="label">액션 후보</p>
            <p className="mt-1 text-2xl font-semibold">{data.topActionable.length}</p>
          </div>
          <div className="panel-muted p-3">
            <p className="label">감시리스트</p>
            <p className="mt-1 text-2xl font-semibold">{data.watchlist.items.length}</p>
          </div>
          <div className="panel-muted p-3">
            <p className="label">리스크 경고</p>
            <p className="mt-1 text-2xl font-semibold">{data.riskAlerts.length}</p>
          </div>
          <div className="panel-muted p-3">
            <p className="label">유니버스</p>
            <p className="mt-1 text-2xl font-semibold">{data.candidates.length}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-3">
        <Panel title="오늘의 Top 3 액션 후보" subtitle="조건 충족 시 우선 확인할 이름입니다.">
          <div className="space-y-3">
            {data.topActionable.map((candidate) => (
              <Link
                key={candidate.profile.ticker}
                href={`/stocks/${candidate.profile.ticker}`}
                className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-cyan-400/30 hover:bg-white/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">{candidate.profile.ticker}</span>
                      <Badge tone={labelTone(candidate.label)}>{displayCandidateLabel(candidate.label)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-300">{candidate.narrative.whyWatch[0]}</p>
                  </div>
                  <ScoreBadge score={candidate.score.finalScore} />
                </div>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="Top 5 감시리스트" subtitle="하루 1~2회 체크로 압축된 감시 후보입니다.">
          <div className="space-y-3">
            {data.watchlist.items.slice(0, 5).map((item) => (
              <div key={item.ticker} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{item.ticker}</span>
                    {item.isNew ? <Badge tone="info">신규</Badge> : null}
                  </div>
                  <span className={`text-sm font-medium ${deltaTone(item.deltaFromPrior)}`}>
                    {item.deltaFromPrior >= 0 ? "+" : ""}
                    {item.deltaFromPrior.toFixed(1)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{item.reason}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Avoid 3" subtitle="지금은 추격보다 피하는 편이 나은 종목입니다.">
          <div className="space-y-3">
            {data.avoidList.map((candidate) => (
              <div key={candidate.profile.ticker} className="rounded-2xl border border-rose-400/15 bg-rose-400/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{candidate.profile.ticker}</span>
                      <Badge tone="danger">회피</Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{candidate.narrative.whyNotYet[0]}</p>
                  </div>
                  <ScoreBadge score={candidate.score.finalScore} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Market Regime Summary" subtitle={data.market.aiSummary} action={<span className="pill">{displayRegime(data.market.regime)}</span>}>
          <div className="grid gap-3 sm:grid-cols-3">
            {data.market.indices.concat(data.market.macroAssets).map((item) => (
              <div key={item.symbol} className="panel-muted p-4">
                <p className="label">{item.name}</p>
                <p className="mt-1 text-xl font-semibold">{item.value.toLocaleString()}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                  <span>{formatPercent(item.change1dPct)}</span>
                  <span className="text-slate-500">5일 {formatPercent(item.change5dPct)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {data.market.economicEvents.map((event) => (
              <div key={event.id} className="rounded-2xl border border-white/10 bg-surface-800/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{event.title}</p>
                  <Badge tone={event.impact === "high" ? "danger" : event.impact === "medium" ? "caution" : "neutral"}>{displayImpact(event.impact)}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-400">{formatDate(event.date)}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{event.note}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Strong Sectors / Themes" subtitle={data.themeSummary}>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-medium text-slate-300">섹터 상대강도</p>
              <div className="space-y-3">
                {data.sectors.slice(0, 5).map((sector) => (
                  <div key={sector.sector}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{displaySector(sector.sector)}</span>
                      <span className="text-slate-300">{sector.score}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/6">
                      <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300" style={{ width: `${sector.score}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      5일 {formatPercent(sector.performance5dPct)} / 20일 {formatPercent(sector.performance20dPct)} / 60일 {formatPercent(sector.performance60dPct)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-3 text-sm font-medium text-slate-300">테마 모멘텀</p>
              <div className="space-y-3">
                {data.themes.slice(0, 5).map((theme) => (
                  <div key={theme.name} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{displayTheme(theme.name)}</p>
                        <p className="text-xs text-slate-400">언급 {theme.newsMentions}건, 감성 {theme.sentimentScore}</p>
                      </div>
                      <ScoreBadge score={theme.score} />
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{theme.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <Panel
          title="Top Stock Candidates"
          subtitle="점수 기반으로 감시 우선순위를 압축합니다. 지금 당장 매수 추천이 아니라 감시 후보 선별용 화면입니다."
          className="xl:col-span-1"
          action={isPending ? <Badge tone="info">다시 계산 중</Badge> : <Badge tone="neutral">{filteredCandidates.length}개 표시</Badge>}
        >
          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">유니버스</span>
              <select
                value={universe}
                onChange={(event) => handleUniverseChange(event.target.value as UniverseKey)}
                className="w-full rounded-2xl border border-white/10 bg-surface-800 px-3 py-2 text-sm outline-none"
              >
                {universeDefinitions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-300">
              <span className="mb-1 block">검색</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-surface-800 px-3 py-2 text-sm outline-none"
                placeholder="티커 또는 회사명"
              />
            </label>

            <label className="text-sm text-slate-300">
              <span className="mb-1 block">섹터</span>
              <select
                value={filters.sector}
                onChange={(event) => setFilters((current) => ({ ...current, sector: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-surface-800 px-3 py-2 text-sm outline-none"
              >
                {sectorOptions.map((option) => (
                  <option key={option} value={option}>
                    {displaySectorFilter(option)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-300">
              <span className="mb-1 block">최소 시총</span>
              <select
                value={filters.marketCapMinBn}
                onChange={(event) => setFilters((current) => ({ ...current, marketCapMinBn: Number(event.target.value) }))}
                className="w-full rounded-2xl border border-white/10 bg-surface-800 px-3 py-2 text-sm outline-none"
              >
                {[10, 25, 50, 100, 250].map((value) => (
                  <option key={value} value={value}>
                    {value}B+
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-300">
              <span className="mb-1 block">최소 평균 거래대금</span>
              <select
                value={filters.averageDollarVolumeMinM}
                onChange={(event) => setFilters((current) => ({ ...current, averageDollarVolumeMinM: Number(event.target.value) }))}
                className="w-full rounded-2xl border border-white/10 bg-surface-800 px-3 py-2 text-sm outline-none"
              >
                {[50, 100, 250, 500, 1000].map((value) => (
                  <option key={value} value={value}>
                    {value}M+
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-300">
              <span className="mb-1 block">최대 ATR</span>
              <select
                value={filters.volatilityMaxPct}
                onChange={(event) => setFilters((current) => ({ ...current, volatilityMaxPct: Number(event.target.value) }))}
                className="w-full rounded-2xl border border-white/10 bg-surface-800 px-3 py-2 text-sm outline-none"
              >
                {[4, 6, 8, 10, 12].map((value) => (
                  <option key={value} value={value}>
                    {value}%
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-surface-800 px-3 py-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={filters.excludeEarningsWindow}
                onChange={(event) => setFilters((current) => ({ ...current, excludeEarningsWindow: event.target.checked }))}
              />
              실적 임박 종목 제외
            </label>

            <a href="/api/export" className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10">
              CSV 내보내기
            </a>
          </div>

          {universe === "custom" ? (
            <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row">
              <input
                value={customTickerInput}
                onChange={(event) => setCustomTickerInput(event.target.value.toUpperCase())}
                className="flex-1 rounded-2xl border border-white/10 bg-surface-800 px-3 py-2 text-sm outline-none"
                placeholder="예: NVDA, AMD, PLTR"
              />
              <button
                type="button"
                onClick={handleCustomUniverse}
                className="rounded-2xl bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-300"
              >
                사용자 유니버스 적용
              </button>
            </div>
          ) : null}

          <div className="space-y-3">
            {filteredCandidates.map((candidate) => {
              const isSaved = savedTickers.has(candidate.profile.ticker);
              const snapshot = snapshotMap.get(candidate.profile.ticker);

              return (
                <div key={candidate.profile.ticker} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/stocks/${candidate.profile.ticker}`} className="text-lg font-semibold text-slate-50 hover:text-cyan-200">
                          {candidate.profile.ticker}
                        </Link>
                        <span className="text-sm text-slate-400">{candidate.profile.companyName}</span>
                        <Badge tone="neutral">{displaySector(candidate.profile.sector)}</Badge>
                        <Badge tone={labelTone(candidate.label)}>{displayCandidateLabel(candidate.label)}</Badge>
                        {candidate.profile.themes.map((theme) => (
                          <Badge key={theme} tone="info">
                            {displayTheme(theme)}
                          </Badge>
                        ))}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-300">{candidate.profile.description}</p>
                      <div className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-2">
                        <p>왜 보는가: {candidate.narrative.whyWatch[0]}</p>
                        <p>왜 아직 아닌가: {candidate.narrative.whyNotYet[0]}</p>
                        <p>유효 확인: {candidate.narrative.confirmation[0]}</p>
                        <p>무효 조건: {candidate.narrative.invalidation[0]}</p>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-400 md:grid-cols-4">
                        <span>현재가 {formatCurrency(candidate.quote.price)}</span>
                        <span>20일 {formatPercent(candidate.quote.change20dPct)}</span>
                        <span>52주 고점 대비 {candidate.technicals.distanceFromHighPct.toFixed(1)}%</span>
                        <span>거래량 {candidate.technicals.volumeRatio.toFixed(2)}배</span>
                      </div>
                      {snapshot ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span>감시 이유: {snapshot.reason}</span>
                          <span>핵심 가격대 {snapshot.keyLevel.toFixed(2)}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex w-full flex-col gap-3 lg:w-56">
                      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-surface-800/80 px-4 py-3">
                        <span className="text-sm text-slate-300">종합 점수</span>
                        <ScoreBadge score={candidate.score.finalScore} />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleWatchlist(candidate.profile.ticker)}
                        className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                          isSaved ? "bg-rose-400/15 text-rose-200 hover:bg-rose-400/25" : "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                        }`}
                      >
                        {isSaved ? "감시리스트에서 제거" : "감시리스트에 저장"}
                      </button>
                      <Link
                        href={`/stocks/${candidate.profile.ticker}`}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-center text-sm text-slate-200 transition hover:bg-white/10"
                      >
                        상세 보기
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Risk Alerts" subtitle="실적, 변동성, 추격 리스크를 우선 정리합니다.">
            <div className="space-y-3">
              {data.riskAlerts.map((alert) => (
                <div key={alert.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-50">{alert.title}</p>
                    <Badge tone={alert.severity === "high" ? "danger" : alert.severity === "medium" ? "caution" : "neutral"}>
                      {displaySeverity(alert.severity)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{alert.reason}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="My Watchlist" subtitle="저장한 종목과 오늘 스냅샷을 한 번에 봅니다.">
            <div className="space-y-3">
              {myWatchlistRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 p-4 text-sm text-slate-400">
                  아직 저장한 종목이 없습니다. 후보 카드에서 감시리스트에 저장을 눌러보세요.
                </div>
              ) : (
                myWatchlistRows.map((row) => (
                  <div key={row.saved.ticker} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-50">{row.saved.ticker}</p>
                        <p className="text-sm text-slate-400">{row.candidate?.profile.companyName ?? row.snapshot?.companyName}</p>
                      </div>
                      {row.snapshot ? <Badge tone="info">{displayCandidateLabel(row.snapshot.label)}</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{row.snapshot?.reason ?? row.saved.note ?? "저장된 감시 종목"}</p>
                    {row.snapshot ? (
                      <div className="mt-2 grid gap-2 text-xs text-slate-400 md:grid-cols-2">
                        <span>무효 조건: {row.snapshot.invalidation}</span>
                        <span>다음 체크: {row.snapshot.nextCheckpoint}</span>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}
