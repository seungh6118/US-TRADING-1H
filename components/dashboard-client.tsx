"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState, useTransition } from "react";
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
  displayTheme
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

function watchlistDeltaTone(value: number) {
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

  const savedTickers = new Set(saved.map((item) => item.ticker));
  const filteredCandidates = data.candidates.filter((candidate) => {
    const searchPass =
      deferredSearch.trim().length === 0 ||
      candidate.profile.ticker.toLowerCase().includes(deferredSearch.toLowerCase()) ||
      candidate.profile.companyName.toLowerCase().includes(deferredSearch.toLowerCase());
    const marketCapPass = candidate.fundamentals.marketCapBn >= filters.marketCapMinBn;
    const volumePass = candidate.fundamentals.averageDollarVolumeM >= filters.averageDollarVolumeMinM;
    const sectorPass = filters.sector === "All" || candidate.profile.sector === filters.sector;
    const volatilityPass = candidate.technicals.atrPct <= filters.volatilityMaxPct;
    const earningsPass = !filters.excludeEarningsWindow || new Date(candidate.earnings.nextEarningsDate).getTime() - Date.now() > 7 * 86400000;
    return searchPass && marketCapPass && volumePass && sectorPass && volatilityPass && earningsPass;
  });

  const sectorOptions = ["All", ...Array.from(new Set(data.candidates.map((candidate) => candidate.profile.sector)))];
  const snapshotMap = new Map(data.watchlist.items.map((item) => [item.ticker, item]));
  const myWatchlistRows = saved
    .map((item) => {
      const match = data.candidates.find((candidate) => candidate.profile.ticker === item.ticker);
      const snapshot = snapshotMap.get(item.ticker);
      return match || snapshot ? { saved: item, candidate: match, snapshot } : null;
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

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
          </div>
          <h1 className="max-w-3xl text-4xl text-slate-50 sm:text-5xl">한국 거주 투자자를 위한 미국 스윙 후보 압축 리서치</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            {data.status.note} 생성 시각 {formatDateTime(data.generatedAt)}. 이 앱의 목적은 지금 당장 매수 추천을 하는 것이 아니라, 오늘과 이번 주에 감시할 가치가 높은 종목을 빠르게 추리는 것입니다.
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
            <p className="label">리스크 경보</p>
            <p className="mt-1 text-2xl font-semibold">{data.riskAlerts.length}</p>
          </div>
          <div className="panel-muted p-3">
            <p className="label">유니버스</p>
            <p className="mt-1 text-xl font-semibold">{data.candidates.length}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-3">
        <Panel title="오늘 바로 볼 Top 3" subtitle="점수와 차트 구조가 가장 깔끔한 후보입니다.">
          <div className="space-y-3">
            {data.topActionable.map((candidate) => (
              <Link key={candidate.profile.ticker} href={`/stocks/${candidate.profile.ticker}`} className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-cyan-400/30 hover:bg-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">{candidate.profile.ticker}</span>
                      <Badge tone="positive">{displayCandidateLabel(candidate.label)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-300">{candidate.narrative.whyWatch[0]}</p>
                  </div>
                  <ScoreBadge score={candidate.score.finalScore} />
                </div>
              </Link>
            ))}
          </div>
        </Panel>
        <Panel title="Top 5 감시리스트" subtitle="하루 1~2회 체크용으로 압축한 핵심 후보입니다.">
          <div className="space-y-3">
            {data.watchlist.items.slice(0, 5).map((item) => (
              <div key={item.ticker} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{item.ticker}</span>
                    {item.isNew ? <Badge tone="info">신규</Badge> : null}
                  </div>
                  <span className={`text-sm font-medium ${watchlistDeltaTone(item.deltaFromPrior)}`}>{item.deltaFromPrior >= 0 ? "+" : ""}{item.deltaFromPrior.toFixed(1)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{item.reason}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="회피 리스트 3" subtitle="현재는 보상 대비 리스크가 더 큰 종목입니다.">
          <div className="space-y-3">
            {data.avoidList.map((candidate) => (
              <div key={candidate.profile.ticker} className="rounded-2xl border border-rose-400/15 bg-rose-400/5 p-4">
                <div className="flex items-center justify-between gap-3">
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

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr] xl:grid-cols-[1.2fr_0.8fr]">
        <Panel
          title="시장 레짐 요약"
          subtitle={data.market.aiSummary}
          className="lg:col-span-1"
          action={<span className="pill">{displayRegime(data.market.regime)}</span>}
        >
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

        <Panel title="강한 섹터 / 테마" subtitle={data.themeSummary}>
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
                    <p className="mt-1 text-xs text-slate-400">5일 {formatPercent(sector.performance5dPct)} / 20일 {formatPercent(sector.performance20dPct)} / 60일 {formatPercent(sector.performance60dPct)}</p>
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
          title="상위 종목 후보"
          subtitle="설명 가능한 점수 기반 랭킹입니다. 무작정 추격하기보다 필터로 스윙 후보를 압축해서 보세요."
          className="lg:col-span-1 xl:col-span-1"
          action={isPending ? <Badge tone="info">다시 계산 중...</Badge> : <Badge tone="neutral">{filteredCandidates.length}개 표시</Badge>}
        >
          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">유니버스</span>
              <select value={universe} onChange={(event) => handleUniverseChange(event.target.value as UniverseKey)} className="w-full rounded-2xl border border-white/10 bg-surface-800 px-3 py-2 text-sm outline-none">
                {universeDefinitions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">검색</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-surface-800 px-3 py-2 text-sm outline-none" placeholder="티커 또는 기업명" />
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">섹터</span>
              <select value={filters.sector} onChange={(event) => setFilters((current) => ({ ...current, sector: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-surface-800 px-3 py-2 text-sm outline-none">
                {sectorOptions.map((option) => (
                  <option key={option} value={option}>
                    {displaySectorFilter(option)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">최소 시총</span>
              <select value={filters.marketCapMinBn} onChange={(event) => setFilters((current) => ({ ...current, marketCapMinBn: Number(event.target.value) }))} className="w-full rounded-2xl border border-white/10 bg-surface-800 px-3 py-2 text-sm outline-none">
                {[10, 25, 50, 100, 250].map((value) => (
                  <option key={value} value={value}>
                    {value}B+
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">최소 평균 거래대금</span>
              <select value={filters.averageDollarVolumeMinM} onChange={(event) => setFilters((current) => ({ ...current, averageDollarVolumeMinM: Number(event.target.value) }))} className="w-full rounded-2xl border border-white/10 bg-surface-800 px-3 py-2 text-sm outline-none">
                {[50, 100, 250, 500, 1000].map((value) => (
                  <option key={value} value={value}>
                    {value}M+
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">최대 ATR</span>
              <select value={filters.volatilityMaxPct} onChange={(event) => setFilters((current) => ({ ...current, volatilityMaxPct: Number(event.target.value) }))} className="w-full rounded-2xl border border-white/10 bg-surface-800 px-3 py-2 text-sm outline-none">
                {[4, 6, 8, 10, 12].map((value) => (
                  <option key={value} value={value}>
                    {value}%
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
              <input type="checkbox" checked={filters.excludeEarningsWindow} onChange={(event) => setFilters((current) => ({ ...current, excludeEarningsWindow: event.target.checked }))} />
              실적 발표 7일 이내 종목 제외
            </label>
            <div className="md:col-span-2 xl:col-span-2">
              <div className="flex gap-2">
                <input value={customTickerInput} onChange={(event) => setCustomTickerInput(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-surface-800 px-3 py-2 text-sm outline-none" placeholder="사용자 지정 티커, 쉼표로 구분" />
                <button type="button" onClick={handleCustomUniverse} className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/20">
                  반영
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.22em] text-slate-500">
                <tr>
                  <th className="pb-3 pr-4">종목</th>
                  <th className="pb-3 pr-4">점수</th>
                  <th className="pb-3 pr-4">라벨</th>
                  <th className="pb-3 pr-4">왜 보는가</th>
                  <th className="pb-3 pr-4">왜 아직 아닌가</th>
                  <th className="pb-3 pr-4">핵심 가격대</th>
                  <th className="pb-3 text-right">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredCandidates.map((candidate) => (
                  <tr key={candidate.profile.ticker} className="align-top">
                    <td className="py-4 pr-4">
                      <Link href={`/stocks/${candidate.profile.ticker}`} className="block">
                        <div className="font-semibold text-slate-50">{candidate.profile.ticker}</div>
                        <div className="text-xs text-slate-400">{candidate.profile.companyName}</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {candidate.profile.themes.map((theme) => (
                            <Badge key={theme} tone="neutral">{displayTheme(theme)}</Badge>
                          ))}
                        </div>
                      </Link>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="space-y-2">
                        <ScoreBadge score={candidate.score.finalScore} />
                        <p className="text-xs text-slate-400">시총 {candidate.fundamentals.marketCapBn >= 100 ? candidate.fundamentals.marketCapBn.toFixed(0) : candidate.fundamentals.marketCapBn.toFixed(1)}B</p>
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <Badge tone={candidate.label === "Avoid" ? "danger" : candidate.label === "Earnings watch" ? "caution" : "positive"}>{displayCandidateLabel(candidate.label)}</Badge>
                    </td>
                    <td className="py-4 pr-4 text-slate-300">{candidate.narrative.whyWatch[0]}</td>
                    <td className="py-4 pr-4 text-slate-400">{candidate.narrative.whyNotYet[0]}</td>
                    <td className="py-4 pr-4">
                      <div className="text-slate-200">트리거 {formatCurrency(candidate.keyLevels.breakout)}</div>
                      <div className="text-xs text-slate-500">무효화 {formatCurrency(candidate.keyLevels.invalidation)}</div>
                    </td>
                    <td className="py-4 text-right">
                      <button type="button" onClick={() => handleToggleWatchlist(candidate.profile.ticker)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-300/30 hover:bg-white/10">
                        {savedTickers.has(candidate.profile.ticker) ? "저장됨" : "저장"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="리스크 경보" subtitle="겉보기에는 좋아 보여도 흐름을 훼손할 수 있는 리스크를 먼저 보여줍니다.">
            <div className="space-y-3">
              {data.riskAlerts.map((alert) => (
                <div key={alert.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-50">{alert.title}</p>
                      <p className="mt-1 text-sm text-slate-300">{alert.reason}</p>
                    </div>
                    <Badge tone={alert.severity === "high" ? "danger" : alert.severity === "medium" ? "caution" : "neutral"}>{displaySeverity(alert.severity)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="내 감시리스트"
            subtitle="저장한 종목과 오늘 스냅샷 변화를 함께 봅니다."
            action={<a href="/api/export?scope=snapshot" className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/10">CSV 내보내기</a>}
          >
            <div className="space-y-3">
              {myWatchlistRows.map((row) => (
                <div key={row.saved.ticker} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{row.saved.ticker}</span>
                        {row.snapshot?.isNew ? <Badge tone="info">신규 후보</Badge> : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-300">{row.candidate?.narrative.whyWatch[0] ?? row.snapshot?.reason ?? "계속 감시할 종목으로 저장되어 있습니다."}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-200">{row.snapshot ? row.snapshot.score.toFixed(1) : "--"}</div>
                      {row.snapshot ? <div className={`text-xs ${watchlistDeltaTone(row.snapshot.deltaFromPrior)}`}>{row.snapshot.deltaFromPrior >= 0 ? "+" : ""}{row.snapshot.deltaFromPrior.toFixed(1)} 전일 대비</div> : null}
                    </div>
                  </div>
                </div>
              ))}
              {myWatchlistRows.length === 0 ? <p className="text-sm text-slate-400">아직 저장한 종목이 없습니다. 후보 테이블에서 저장 버튼을 눌러 나만의 감시리스트를 만들어보세요.</p> : null}
            </div>
            <div className="mt-5 grid gap-3">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-500">신규 후보</p>
                <div className="flex flex-wrap gap-2">
                  {data.watchlist.items.filter((item) => item.isNew).map((item) => (
                    <span key={item.ticker} className="pill">{item.ticker}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-500">전일 대비 제외</p>
                <div className="flex flex-wrap gap-2">
                  {data.watchlist.removedTickers.length > 0 ? data.watchlist.removedTickers.map((ticker) => <span key={ticker} className="pill">{ticker}</span>) : <span className="text-sm text-slate-400">제외된 종목이 없습니다.</span>}
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}