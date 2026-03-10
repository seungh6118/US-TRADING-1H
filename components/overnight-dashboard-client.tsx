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

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      const parsed = normalizeClientSettings(JSON.parse(stored) as Partial<OvernightSettings>);
      setSettings(parsed);
      setOnlyA(parsed.onlyAGrade);
      void fetchScan(parsed).then(setData);
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
        .then(setData)
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
      subtitle="장마감 10~15분 전에 익일 갭 상승 또는 장초반 강세 확률이 높은 종목만 빠르게 골라내는 오버나이트 전용 보드입니다."
      right={
        <div className="hero-stat">
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone={marketTone(data.marketBrief.marketTone)}>{data.marketBrief.marketTone}</Tag>
            <Tag tone="info">마감 {data.marketBrief.closeCountdownMinutes}분 전</Tag>
            {isRefreshing ? <Tag tone="caution">새로고침 중</Tag> : null}
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-200">{data.marketBrief.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.marketBrief.sectorLeaders.map((item) => (
              <Tag key={item} tone="positive">
                {item}
              </Tag>
            ))}
          </div>
          <p className="mt-4 text-xs leading-6 text-slate-400">기준 시각 {formatDateTime(data.generatedAt)}</p>
        </div>
      }
    >
      <div className="mb-6 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="빠른 필터" subtitle="장마감 직전 판단에 필요한 조건만 남겼습니다.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">검색</span>
              <input className="filter-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="티커 / 회사명" />
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
              장마감 직전 자동 새로고침
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
              <p className="label">최소 시총</p>
              <p className="mt-1 text-sm font-semibold text-white">{settings.minMarketCapBn.toFixed(0)}B</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="알림 프리뷰" subtitle="MVP 단계에서는 화면 내 프리뷰로 먼저 제공합니다.">
          <div className="space-y-3">
            {data.alerts.map((alert) => (
              <div key={alert.id} className="candidate-metric">
                <p className="label">{alert.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">{alert.detail}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="종가베팅 후보 TOP 10"
        subtitle="점수순으로 정렬되며, 추천 이유 3개와 리스크 3개를 바로 확인할 수 있습니다."
        action={<Tag tone="info">{filtered.length}개 표시</Tag>}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.slice(0, 10).map((candidate, index) => (
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
                    {formatPercent(candidate.dayChangePct)}
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
                  <p className="label">주의할 리스크 3개</p>
                  <div className="mt-2 space-y-1 text-sm leading-6 text-slate-300">
                    {candidate.risks.slice(0, 3).map((item) => (
                      <p key={item}>- {item}</p>
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </SectionCard>
    </AppShell>
  );
}
