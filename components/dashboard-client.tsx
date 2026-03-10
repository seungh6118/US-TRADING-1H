"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { CandidateHeatmap } from "@/components/candidate-heatmap";
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

function changeTone(value: number) {
  if (value > 0) {
    return "text-emerald-300";
  }
  if (value < 0) {
    return "text-rose-300";
  }
  return "text-slate-200";
}

function formatBillions(value: number) {
  if (!value || Number.isNaN(value)) {
    return "N/A";
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}T`;
  }

  return `${value.toFixed(value >= 100 ? 0 : 1)}B`;
}

function summarizeBrief(items: string[], count = 2) {
  return items.slice(0, count).join(" / ");
}

function shortTermPriority(candidate: DashboardData["candidates"][number]) {
  const labelBonus =
    candidate.label === "Breakout candidate"
      ? 8
      : candidate.label === "Pullback candidate"
        ? 5
        : candidate.label === "Watch"
          ? 2
          : candidate.label === "Avoid"
            ? -8
            : 0;

  return (
    candidate.score.finalScore * 0.62 +
    candidate.quote.change1dPct * 2.8 +
    candidate.quote.change5dPct * 1.5 +
    candidate.technicals.volumeRatio * 3.2 +
    labelBonus -
    candidate.score.riskPenalty * 10
  );
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
  const isMock = data.status.runtimeMode === "mock";

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
        !candidate.earnings.nextEarningsDate ||
        new Date(candidate.earnings.nextEarningsDate).getTime() - Date.now() > 7 * 86400000;

      return searchPass && marketCapPass && volumePass && sectorPass && volatilityPass && earningsPass;
    });
  }, [data.candidates, deferredSearch, filters]);

  const rankedCandidates = useMemo(
    () => [...filteredCandidates].sort((left, right) => shortTermPriority(right) - shortTermPriority(left)),
    [filteredCandidates]
  );

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

  const heatmapCandidates = rankedCandidates.length > 0 ? rankedCandidates : [...data.candidates].sort((left, right) => shortTermPriority(right) - shortTermPriority(left));
  const shortTermFocus = heatmapCandidates.slice(0, 3);
  const marketTape = data.market.indices.concat(data.market.macroAssets).slice(0, 6);

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
    <main className="mx-auto max-w-[1480px] px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
      <section className="hero-panel mb-6">
        <div className="grid gap-6 px-5 py-6 sm:px-6 lg:px-8 lg:py-8 xl:grid-cols-[1.18fr_0.82fr]">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone="info">S&amp;P500 단기 상승 후보 리서치</Badge>
              <Badge tone={regimeTone(data.market.regime)}>{displayRegime(data.market.regime)}</Badge>
              <Badge tone={data.status.runtimeMode === "mock" ? "caution" : "positive"}>{displayRuntimeMode(data.status.runtimeMode)}</Badge>
              {isMock ? <Badge tone="danger">실시간 아님</Badge> : null}
              <Badge tone="neutral">{displayUniverse(data.universe)}</Badge>
            </div>
            <h1 className="max-w-4xl text-4xl leading-tight text-slate-50 sm:text-5xl lg:text-[3.3rem]">S&amp;P500 단기 상승 후보 리서치</h1>
            <p className="mt-4 max-w-4xl text-base leading-7 text-slate-200/90">
              {data.status.note} 생성 시각 {formatDateTime(data.generatedAt)}. 핵심 목적은 S&amp;P500 안에서 AI가 감지한
              2~3일 단기 상승 후보를 우선순위대로 바로 보여주는 것입니다. 가장 먼저 볼 이름이 위로, 더 크게 나오도록 정렬했습니다.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <span className="pill">히트맵 크기 = 추천 우선순위</span>
              <span className="pill">히트맵 색 = 1일 강도</span>
              <span className="pill">추천 기준 = 2~3일 시나리오</span>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/8 bg-black/16 p-4 sm:p-5">
            <p className="label">AI 단기 1~3순위</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">지금 화면 기준으로 2~3일 안에 가장 먼저 볼 후보입니다.</p>
            <div className="mt-4 space-y-3">
              {shortTermFocus.map((candidate, index) => (
                <Link
                  key={candidate.profile.ticker}
                  href={`/stocks/${candidate.profile.ticker}`}
                  className="block rounded-[20px] border border-white/8 bg-white/5 px-4 py-4 transition hover:border-cyan-400/30 hover:bg-white/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">우선순위 #{index + 1}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xl font-semibold text-white">{candidate.profile.ticker}</span>
                        <Badge tone={labelTone(candidate.label)}>{displayCandidateLabel(candidate.label)}</Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{candidate.narrative.whyWatch[0]}</p>
                    </div>
                    <ScoreBadge score={candidate.score.finalScore} />
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-4 rounded-[18px] border border-cyan-400/12 bg-cyan-400/6 px-4 py-3 text-sm leading-6 text-slate-200">
              가장 큰 타일이 현재 1순위입니다. 왼쪽 위에서 오른쪽 아래로 갈수록 후순위로 보시면 됩니다.
            </div>
          </div>
        </div>
      </section>

      {isMock ? (
        <div className="mb-6 rounded-[28px] border border-rose-400/20 bg-rose-400/10 p-4 text-sm leading-6 text-rose-100">
          현재 배포본은 실시간 시세가 아니라 샘플 데이터입니다. 현재가, 20일 수익률, 52주 고점 대비, 거래량 배수는 실제 시장값이 아니므로 매매 판단에 쓰면 안 됩니다.
        </div>
      ) : null}

      <div className="mb-6">
        <Panel title="오늘의 시장 스캔맵" subtitle="왼쪽 위, 그리고 더 큰 타일일수록 현재 추천 우선순위가 높습니다. 색은 1일 강도를 뜻합니다.">
          <CandidateHeatmap candidates={heatmapCandidates} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel
          title="시장 브리프"
          subtitle={`${data.marketRecap.sessionDate} 장세를 10초 안에 읽는 요약판입니다.`}
          action={<span className="pill">{displayRegime(data.market.regime)}</span>}
        >
          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="candidate-metric">
              <p className="label">지수 흐름</p>
              <p className="mt-2 text-sm leading-6 text-slate-100">{summarizeBrief(data.marketRecap.indexFlow) || "데이터 확인 중"}</p>
            </div>
            <div className="candidate-metric">
              <p className="label">강한 쪽</p>
              <p className="mt-2 text-sm leading-6 text-emerald-200">{summarizeBrief(data.marketRecap.strongAreas) || "데이터 확인 중"}</p>
            </div>
            <div className="candidate-metric">
              <p className="label">약한 쪽</p>
              <p className="mt-2 text-sm leading-6 text-rose-200">{summarizeBrief(data.marketRecap.weakAreas) || "데이터 확인 중"}</p>
            </div>
            <div className="candidate-metric">
              <p className="label">튀는 종목</p>
              <p className="mt-2 text-sm leading-6 text-cyan-100">{summarizeBrief(data.marketRecap.standoutMovers) || "데이터 확인 중"}</p>
            </div>
          </div>

          <div className="mb-4 rounded-[22px] border border-cyan-400/15 bg-cyan-400/6 p-4 text-sm leading-6 text-slate-100">
            <p className="label">한 줄 해석</p>
            <p className="mt-2">{data.marketRecap.interpretation}</p>
          </div>

          <div className="mb-4 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            {marketTape.map((item) => (
              <div key={item.symbol} className="candidate-metric">
                <p className="label">{item.name}</p>
                <p className="mt-1 text-base font-semibold text-white">{item.value.toLocaleString()}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                  <span className={changeTone(item.change1dPct)}>{formatPercent(item.change1dPct)}</span>
                  <span className="text-slate-500">5일 {formatPercent(item.change5dPct)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {data.market.economicEvents.slice(0, 4).map((event) => (
              <div key={event.id} className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3 py-2 text-xs text-slate-200">
                <span>{event.title}</span>
                <Badge tone={event.impact === "high" ? "danger" : event.impact === "medium" ? "caution" : "neutral"}>{displayImpact(event.impact)}</Badge>
                <span className="text-slate-400">{formatDate(event.date)}</span>
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
                    <p className="mt-1 text-xs text-slate-400">
                      1일 {formatPercent(sector.performance1dPct)} / 5일 {formatPercent(sector.performance5dPct)} / 20일 {formatPercent(sector.performance20dPct)} / 60일 {formatPercent(sector.performance60dPct)}
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
          title="후보 전체 랭킹"
          subtitle="트리거, 지지, 무효 가격을 중심으로 빠르게 훑는 트레이더형 보드입니다."
          className="xl:col-span-1"
          action={isPending ? <Badge tone="info">다시 계산 중</Badge> : <Badge tone="neutral">{heatmapCandidates.length}개 표시</Badge>}
        >
          <div className="filter-shell mb-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">유니버스</span>
              <select
                value={universe}
                onChange={(event) => handleUniverseChange(event.target.value as UniverseKey)}
                className="filter-input"
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
                className="filter-input"
                placeholder="티커 또는 회사명"
              />
            </label>

            <label className="text-sm text-slate-300">
              <span className="mb-1 block">섹터</span>
              <select
                value={filters.sector}
                onChange={(event) => setFilters((current) => ({ ...current, sector: event.target.value }))}
                className="filter-input"
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
                className="filter-input"
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
                className="filter-input"
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
                className="filter-input"
              >
                {[4, 6, 8, 10, 12].map((value) => (
                  <option key={value} value={value}>
                    {value}%
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 rounded-[18px] border border-white/8 bg-black/10 px-3 py-2.5 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={filters.excludeEarningsWindow}
                onChange={(event) => setFilters((current) => ({ ...current, excludeEarningsWindow: event.target.checked }))}
              />
              실적 임박 종목 제외
            </label>

            <a href="/api/export" className="subtle-action inline-flex items-center justify-center text-slate-100">
              CSV 내보내기
            </a>
            </div>

            {universe === "custom" ? (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                value={customTickerInput}
                onChange={(event) => setCustomTickerInput(event.target.value.toUpperCase())}
                className="filter-input flex-1"
                placeholder="예: NVDA, AMD, PLTR"
              />
              <button
                type="button"
                onClick={handleCustomUniverse}
                className="primary-action"
              >
                사용자 유니버스 적용
              </button>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            {heatmapCandidates.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-white/14 px-4 py-6 text-sm text-slate-400">
                현재 필터를 통과하는 후보가 없습니다. 시총/거래대금/ATR 조건을 조금 완화해 보세요.
              </div>
            ) : (
              heatmapCandidates.map((candidate, index) => {
                const isSaved = savedTickers.has(candidate.profile.ticker);
                const snapshot = snapshotMap.get(candidate.profile.ticker);

                return (
                  <div key={candidate.profile.ticker} className="candidate-row">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="info">#{index + 1}</Badge>
                          <Link href={`/stocks/${candidate.profile.ticker}`} className="text-xl font-semibold tracking-[-0.03em] text-white transition hover:text-cyan-200">
                            {candidate.profile.ticker}
                          </Link>
                          <span className="text-sm text-slate-400">{candidate.profile.companyName}</span>
                          <Badge tone="neutral">{displaySector(candidate.profile.sector)}</Badge>
                          <Badge tone={labelTone(candidate.label)}>{displayCandidateLabel(candidate.label)}</Badge>
                          {candidate.profile.themes.slice(0, 3).map((theme) => (
                            <Badge key={theme} tone="info">
                              {displayTheme(theme)}
                            </Badge>
                          ))}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-200">{candidate.narrative.whyWatch[0]}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="candidate-metric min-w-[92px] text-center">
                            <p className="label">점수</p>
                            <p className="mt-1 text-lg font-semibold text-white">{candidate.score.finalScore.toFixed(1)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleWatchlist(candidate.profile.ticker)}
                            className={isSaved ? "subtle-action text-rose-200 hover:bg-rose-400/10" : "primary-action"}
                          >
                            {isSaved ? "제거" : "저장"}
                          </button>
                          <Link href={`/stocks/${candidate.profile.ticker}`} className="subtle-action text-center text-slate-100 hover:bg-white/10">
                            상세
                          </Link>
                        </div>
                      </div>

                      <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
                        <div className="candidate-metric md:col-span-2">
                          <p className="label">유효 트리거</p>
                          <p className="mt-1 text-sm font-medium text-cyan-100">{candidate.narrative.confirmation[0]}</p>
                        </div>
                        <div className="candidate-metric">
                          <p className="label">현재가</p>
                          <p className="mt-1 text-sm font-semibold text-white">{formatCurrency(candidate.quote.price)}</p>
                        </div>
                        <div className="candidate-metric">
                          <p className="label">1일</p>
                          <p className={`mt-1 text-sm font-semibold ${changeTone(candidate.quote.change1dPct)}`}>{formatPercent(candidate.quote.change1dPct)}</p>
                        </div>
                        <div className="candidate-metric">
                          <p className="label">5일</p>
                          <p className={`mt-1 text-sm font-semibold ${changeTone(candidate.quote.change5dPct)}`}>{formatPercent(candidate.quote.change5dPct)}</p>
                        </div>
                        <div className="candidate-metric">
                          <p className="label">거래량</p>
                          <p className="mt-1 text-sm font-semibold text-white">{candidate.technicals.volumeRatio.toFixed(2)}x</p>
                        </div>
                        <div className="candidate-metric">
                          <p className="label">돌파</p>
                          <p className="mt-1 text-sm font-semibold text-white">{formatCurrency(candidate.keyLevels.breakout)}</p>
                        </div>
                        <div className="candidate-metric">
                          <p className="label">지지</p>
                          <p className="mt-1 text-sm font-semibold text-white">{formatCurrency(candidate.keyLevels.support)}</p>
                        </div>
                        <div className="candidate-metric">
                          <p className="label">무효</p>
                          <p className="mt-1 text-sm font-semibold text-rose-200">{formatCurrency(candidate.keyLevels.invalidation)}</p>
                        </div>
                      </div>

                      <div className="grid gap-2 text-xs text-slate-400 md:grid-cols-3">
                        <div className="candidate-metric">
                          <p className="label">리스크</p>
                          <p className="mt-1 leading-5 text-slate-300">{candidate.narrative.whyNotYet[0]}</p>
                        </div>
                        <div className="candidate-metric">
                          <p className="label">무효 조건</p>
                          <p className="mt-1 leading-5 text-slate-300">{candidate.narrative.invalidation[0]}</p>
                        </div>
                        <div className="candidate-metric">
                          <p className="label">다음 체크</p>
                          <p className="mt-1 leading-5 text-slate-300">{snapshot?.nextCheckpoint ?? candidate.narrative.whatToWatchNext[0]}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="리스크 경고" subtitle="실적, 변동성, 추격 리스크를 먼저 정리합니다.">
            <div className="space-y-3">
              {data.riskAlerts.map((alert) => (
                <div key={alert.id} className="rounded-[20px] border border-white/8 bg-white/4 p-4">
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

          <Panel title="내 감시리스트" subtitle="저장한 종목과 오늘 스냅샷을 한 번에 봅니다.">
            <div className="space-y-3">
              {myWatchlistRows.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-white/14 p-4 text-sm text-slate-400">
                  아직 저장한 종목이 없습니다. 후보 보드에서 감시리스트에 저장을 눌러보세요.
                </div>
              ) : (
                myWatchlistRows.map((row) => (
                  <div key={row.saved.ticker} className="rounded-[20px] border border-white/8 bg-white/4 p-4">
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



