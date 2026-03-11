"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { defaultOvernightSettings } from "@/lib/overnight-defaults";
import { OvernightDashboardData, OvernightSettings } from "@/lib/overnight-types";
import { formatCompactNumber, formatCurrency, formatDateTime, formatPercent } from "@/lib/utils";
import { AppShell, GradeBadge, ScoreBar, SectionCard, Tag } from "@/components/overnight-ui";

const STORAGE_KEY = "overnight-close-bet-settings";

function normalizeClientSettings(input?: Partial<OvernightSettings>): OvernightSettings {
  return {
    ...defaultOvernightSettings,
    ...input,
    weights: {
      ...defaultOvernightSettings.weights,
      ...input?.weights
    }
  };
}

function suitabilityTone(value: string) {
  if (value === "ideal") {
    return "positive" as const;
  }
  if (value === "allowed") {
    return "info" as const;
  }
  return "danger" as const;
}

function marketTone(value: OvernightDashboardData["marketBrief"]["marketTone"]) {
  if (value === "risk-on") {
    return "positive" as const;
  }
  if (value === "risk-off") {
    return "danger" as const;
  }
  return "caution" as const;
}

async function fetchScan(settings: OvernightSettings) {
  const response = await fetch("/api/scan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ settings })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "실시간 스캔을 불러오지 못했습니다.");
  }

  const payload = (await response.json()) as { data: OvernightDashboardData };
  return payload.data;
}

export function OvernightDashboardClient({ initialData }: { initialData: OvernightDashboardData }) {
  const [data, setData] = useState(initialData);
  const [settings, setSettings] = useState(initialData.settings);
  const [search, setSearch] = useState("");
  const [onlyA, setOnlyA] = useState(initialData.settings.onlyAGrade);
  const [postMarketOnly, setPostMarketOnly] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      const parsed = normalizeClientSettings(JSON.parse(stored) as Partial<OvernightSettings>);
      setSettings(parsed);
      setOnlyA(parsed.onlyAGrade);
      void fetchScan(parsed)
        .then((next) => {
          setData(next);
          setRefreshError(null);
        })
        .catch((error) => {
          setRefreshError(error instanceof Error ? error.message : "실시간 스캔을 불러오지 못했습니다.");
        });
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const interval = window.setInterval(() => {
      setIsRefreshing(true);
      void fetchScan(settings)
        .then((next) => {
          setData(next);
          setRefreshError(null);
        })
        .catch((error) => {
          setRefreshError(error instanceof Error ? error.message : "실시간 스캔을 불러오지 못했습니다.");
        })
        .finally(() => setIsRefreshing(false));
    }, settings.autoRefreshSeconds * 1000);

    return () => window.clearInterval(interval);
  }, [autoRefresh, settings]);

  const filtered = useMemo(() => {
    return data.candidates.filter((candidate) => {
      const searchPass =
        search.trim().length === 0 ||
        candidate.ticker.toLowerCase().includes(search.toLowerCase()) ||
        candidate.companyName.toLowerCase().includes(search.toLowerCase());
      const gradePass = !onlyA || candidate.score.grade === "A";
      const postMarketPass = !postMarketOnly || candidate.postMarketSuitability === "ideal";
      return searchPass && gradePass && postMarketPass;
    });
  }, [data.candidates, onlyA, postMarketOnly, search]);

  return (
    <AppShell
      title="미국주식 종가베팅 스코어링"
      subtitle="장마감 10~15분 전, 익일 갭 상승 또는 시초 강세 확률이 높은 종목만 빠르게 추려내는 오버나이트 전용 보드입니다."
      right={
        <div className="hero-stat">
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone={data.status.mode === "live" ? "positive" : "caution"}>{data.status.mode === "live" ? "실시간" : "모의"}</Tag>
            <Tag tone={marketTone(data.marketBrief.marketTone)}>
              {data.marketBrief.marketTone === "risk-on" ? "리스크 온" : data.marketBrief.marketTone === "risk-off" ? "리스크 오프" : "중립"}
            </Tag>
            <Tag tone="info">유니버스 {data.universeCount}</Tag>
            {isRefreshing ? <Tag tone="caution">새로고침 중</Tag> : null}
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-200">{data.marketBrief.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.marketBrief.sectorLeaders.map((item) => (
              <Tag key={item} tone="positive">
                {item}
              </Tag>
            ))}
            {data.marketBrief.weakGroups.map((item) => (
              <Tag key={item} tone="danger">
                {item}
              </Tag>
            ))}
          </div>
          <p className="mt-4 text-xs leading-6 text-slate-400">
            공급원 {data.status.provider} · 기준 시각 {formatDateTime(data.generatedAt)}
          </p>
        </div>
      }
    >
      <div className="mb-6 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="빠른 필터" subtitle="A급만 보거나 포스트마켓 적합 종목만 골라서 바로 판단할 수 있습니다.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">검색</span>
              <input className="filter-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="티커 또는 회사명" />
            </label>
            <label className="flex items-center gap-2 rounded-[18px] border border-white/8 bg-black/10 px-3 py-2.5 text-sm text-slate-300">
              <input type="checkbox" checked={onlyA} onChange={(event) => setOnlyA(event.target.checked)} />
              A급만 보기
            </label>
            <label className="flex items-center gap-2 rounded-[18px] border border-white/8 bg-black/10 px-3 py-2.5 text-sm text-slate-300">
              <input type="checkbox" checked={postMarketOnly} onChange={(event) => setPostMarketOnly(event.target.checked)} />
              포스트마켓 적합만
            </label>
            <label className="flex items-center gap-2 rounded-[18px] border border-white/8 bg-black/10 px-3 py-2.5 text-sm text-slate-300">
              <input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />
              자동 새로고침
            </label>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <div className="candidate-metric">
              <p className="label">최소 주가</p>
              <p className="mt-1 text-sm font-semibold text-white">{formatCurrency(settings.minPrice)}</p>
            </div>
            <div className="candidate-metric">
              <p className="label">최소 거래량</p>
              <p className="mt-1 text-sm font-semibold text-white">{formatCompactNumber(settings.minAverageVolume)}</p>
            </div>
            <div className="candidate-metric">
              <p className="label">최소 거래대금</p>
              <p className="mt-1 text-sm font-semibold text-white">{settings.minAverageDollarVolumeM.toFixed(0)}M</p>
            </div>
            <div className="candidate-metric">
              <p className="label">최소 시가총액</p>
              <p className="mt-1 text-sm font-semibold text-white">{settings.minMarketCapBn.toFixed(0)}B</p>
            </div>
          </div>

          {refreshError ? (
            <div className="mt-4 rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{refreshError}</div>
          ) : null}
          {data.status.warning ? (
            <div className="mt-4 rounded-[18px] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{data.status.warning}</div>
          ) : null}
        </SectionCard>

        <SectionCard title="시장 브리프" subtitle="장세 방향과 오늘 강한 군집을 먼저 읽고 종가베팅 후보를 좁힙니다.">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="candidate-metric">
              <p className="label">지수 흐름</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.marketBrief.indexFlow.map((item) => (
                  <Tag key={item} tone="info">
                    {item}
                  </Tag>
                ))}
              </div>
            </div>
            <div className="candidate-metric">
              <p className="label">눈여겨볼 종목</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.marketBrief.standoutTickers.map((item) => (
                  <Tag key={item} tone="positive">
                    {item}
                  </Tag>
                ))}
              </div>
            </div>
            <div className="candidate-metric">
              <p className="label">알림 프리뷰</p>
              <div className="mt-2 space-y-2 text-sm leading-6 text-slate-200">
                {data.alerts.map((alert) => (
                  <p key={alert.id}>
                    <span className="font-semibold text-white">{alert.title}</span>: {alert.detail}
                  </p>
                ))}
              </div>
            </div>
            <div className="candidate-metric">
              <p className="label">누적 백테스트</p>
              {data.strategyBacktest ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <p className="text-sm text-slate-200">완료 {data.strategyBacktest.completedTrades}회</p>
                  <p className="text-sm text-slate-200">갭 승률 {data.strategyBacktest.gapWinRatePct.toFixed(1)}%</p>
                  <p className="text-sm text-slate-200">평균 갭 {formatPercent(data.strategyBacktest.averageGapPct)}</p>
                  <p className="text-sm text-slate-200">평균 고점 {formatPercent(data.strategyBacktest.averageHighPct)}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm leading-6 text-slate-300">마감 직전 스냅샷이 쌓이면 익일 결과가 자동으로 누적됩니다.</p>
              )}
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="종가베팅 후보 TOP 3"
        subtitle="엄격 통과 후보를 우선 보여주고, 부족하면 근접 후보까지 채워서 장마감 직전 바로 판단할 3종목만 압축했습니다."
        action={<Tag tone="info">{Math.min(filtered.length, 3)}개 표시</Tag>}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.slice(0, 3).map((candidate, index) => (
            <Link
              key={candidate.ticker}
              href={`/stocks/${candidate.ticker}`}
              className="candidate-row block transition hover:border-cyan-400/25 hover:bg-white/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag tone="info">#{index + 1}</Tag>
                    <h3 className="text-2xl font-semibold text-white">{candidate.ticker}</h3>
                    <GradeBadge grade={candidate.score.grade} />
                    <Tag tone={suitabilityTone(candidate.postMarketSuitability)}>
                      {candidate.postMarketSuitability === "ideal"
                        ? "포스트마켓 적합"
                        : candidate.postMarketSuitability === "allowed"
                          ? "포스트마켓 가능"
                          : "포스트마켓 비추천"}
                    </Tag>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{candidate.companyName}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-200">{candidate.coreSummary}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-semibold text-white">{candidate.score.total.toFixed(1)}</p>
                  <p className="mt-1 text-sm text-slate-300">{formatCurrency(candidate.price)}</p>
                  <p className={`mt-1 text-sm font-medium ${candidate.dayChangePct >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    정규장 {formatPercent(candidate.dayChangePct)}
                  </p>
                  <p className={`mt-1 text-xs ${candidate.afterHoursChangePct >= 0 ? "text-cyan-300" : "text-rose-300"}`}>
                    애프터 {formatPercent(candidate.afterHoursChangePct)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                <ScoreBar label="유동성" value={candidate.score.liquidity} max={settings.weights.liquidity} />
                <ScoreBar label="당일 강도" value={candidate.score.intradayStrength} max={settings.weights.intradayStrength} tone="emerald" />
                <ScoreBar label="거래량/수급" value={candidate.score.flowVolume} max={settings.weights.flowVolume} tone="cyan" />
                <ScoreBar label="뉴스/재료" value={candidate.score.catalystMomentum} max={settings.weights.catalystMomentum} tone="amber" />
                <ScoreBar label="익일 실현" value={candidate.score.nextDayRealizability} max={settings.weights.nextDayRealizability} tone="rose" />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="candidate-metric">
                  <p className="label">추천 이유 3개</p>
                  <div className="mt-2 space-y-1 text-sm leading-6 text-slate-200">
                    {candidate.reasons.slice(0, 3).map((item) => (
                      <p key={item}>- {item}</p>
                    ))}
                  </div>
                </div>
                <div className="candidate-metric">
                  <p className="label">주의 리스크 3개</p>
                  <div className="mt-2 space-y-1 text-sm leading-6 text-slate-300">
                    {candidate.risks.slice(0, 3).map((item) => (
                      <p key={item}>- {item}</p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <div className="candidate-metric">
                  <p className="label">평균 거래대금</p>
                  <p className="mt-1 text-sm font-semibold text-white">{candidate.averageDollarVolumeM.toFixed(0)}M</p>
                </div>
                <div className="candidate-metric">
                  <p className="label">RVOL / 마감 30분</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {candidate.rvol20.toFixed(2)}x / {candidate.close30mVolumeRatio.toFixed(2)}x
                  </p>
                </div>
                <div className="candidate-metric">
                  <p className="label">실적까지 / 저항거리</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {candidate.daysToEarnings}일 / {candidate.distanceToResistancePct.toFixed(1)}%
                  </p>
                </div>
                <div className="candidate-metric">
                  <p className="label">20거래일 백테스트</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    갭업 {candidate.backtest.gapUpRatePct.toFixed(0)}% / 고점 {formatPercent(candidate.backtest.averageMaxGainPct)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </SectionCard>
    </AppShell>
  );
}
