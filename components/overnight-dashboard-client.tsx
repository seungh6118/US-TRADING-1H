"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { defaultOvernightSettings } from "@/lib/overnight-defaults";
import { OvernightCandidate, OvernightDashboardData, OvernightSettings } from "@/lib/overnight-types";
import { formatCompactNumber, formatCurrency, formatDate, formatDateTime, formatPercent } from "@/lib/utils";
import { AppShell, GradeBadge, SectionCard, Tag } from "@/components/overnight-ui";

const STORAGE_KEY = "overnight-close-bet-settings";
const REFRESH_ERROR_MESSAGE = "실시간 스캔 데이터를 불러오지 못했습니다.";

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

function suitabilityLabel(value: OvernightCandidate["postMarketSuitability"]) {
  if (value === "ideal") {
    return "포스트마켓 적합";
  }
  if (value === "allowed") {
    return "포스트마켓 가능";
  }
  return "포스트마켓 비선호";
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

function marketToneLabel(value: OvernightDashboardData["marketBrief"]["marketTone"]) {
  if (value === "risk-on") {
    return "리스크 온";
  }
  if (value === "risk-off") {
    return "리스크 오프";
  }
  return "중립";
}

function signalAlertTone(severity: "high" | "medium" | "low") {
  if (severity === "high") {
    return "positive" as const;
  }
  if (severity === "medium") {
    return "caution" as const;
  }
  return "info" as const;
}

function outcomeTone(value: "success" | "working" | "failed" | "pending") {
  if (value === "success") {
    return "positive" as const;
  }
  if (value === "working") {
    return "caution" as const;
  }
  if (value === "failed") {
    return "danger" as const;
  }
  return "info" as const;
}

function outcomeLabel(value: "success" | "working" | "failed" | "pending") {
  if (value === "success") {
    return "성공";
  }
  if (value === "working") {
    return "진행중";
  }
  if (value === "failed") {
    return "실패";
  }
  return "대기";
}

function tileToneClass(candidate: OvernightCandidate) {
  if (candidate.afterHoursChangePct >= 5 || candidate.score.total >= 72) {
    return "signal-tile-positive-strong";
  }
  if (candidate.afterHoursChangePct >= 1 || candidate.dayChangePct >= 2 || candidate.score.total >= 65) {
    return "signal-tile-positive";
  }
  if (candidate.afterHoursChangePct <= -3 || candidate.dayChangePct <= -3) {
    return "signal-tile-negative-strong";
  }
  if (candidate.afterHoursChangePct < 0 || candidate.dayChangePct < 0) {
    return "signal-tile-negative";
  }
  return "signal-tile-neutral";
}

function countdownLabel(minutes: number) {
  if (minutes > 0) {
    return `장마감까지 ${minutes}분`;
  }
  if (minutes === 0) {
    return "장마감 직전";
  }
  return `마감 후 ${Math.abs(minutes)}분`;
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
    throw new Error(payload.error ?? REFRESH_ERROR_MESSAGE);
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
          setRefreshError(error instanceof Error ? error.message : REFRESH_ERROR_MESSAGE);
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
          setRefreshError(error instanceof Error ? error.message : REFRESH_ERROR_MESSAGE);
        })
        .finally(() => setIsRefreshing(false));
    }, settings.autoRefreshSeconds * 1000);

    return () => window.clearInterval(interval);
  }, [autoRefresh, settings]);

  const filtered = useMemo(() => {
    return data.candidates.filter((candidate) => {
      const query = search.trim().toLowerCase();
      const searchPass =
        query.length === 0 ||
        candidate.ticker.toLowerCase().includes(query) ||
        candidate.companyName.toLowerCase().includes(query);
      const gradePass = !onlyA || candidate.score.grade === "A";
      const postMarketPass = !postMarketOnly || candidate.postMarketSuitability === "ideal";
      return searchPass && gradePass && postMarketPass;
    });
  }, [data.candidates, onlyA, postMarketOnly, search]);

  const topThree = filtered.slice(0, 3);
  const nearMisses = filtered.slice(3, 7);
  const averageAfterHours =
    topThree.length > 0 ? topThree.reduce((sum, candidate) => sum + candidate.afterHoursChangePct, 0) / topThree.length : 0;
  const strategySummary = data.strategyBacktest;

  return (
    <AppShell
      title="S&P500 종가베팅 시그널 보드"
      subtitle="오늘 밤 들고 갈 3종목을 먼저 압축하고, 왜 잡는지와 어디서 털어야 하는지까지 한 화면에서 바로 판단하는 오버나이트 스캐너입니다."
      right={
        <div className="grid gap-3">
          <div className="hero-stat">
            <div className="flex flex-wrap items-center gap-2">
              <Tag tone={data.status.mode === "live" ? "positive" : "caution"}>{data.status.mode === "live" ? "실시간" : "모의"}</Tag>
              <Tag tone={marketTone(data.marketBrief.marketTone)}>{marketToneLabel(data.marketBrief.marketTone)}</Tag>
              <Tag tone="info">{countdownLabel(data.marketBrief.closeCountdownMinutes)}</Tag>
              {isRefreshing ? <Tag tone="caution">재계산 중</Tag> : null}
            </div>
            <p className="mt-4 text-base leading-7 text-slate-100">{data.marketBrief.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {data.marketBrief.sectorLeaders.slice(0, 2).map((item) => (
                <Tag key={item} tone="positive">
                  {item}
                </Tag>
              ))}
              {data.marketBrief.weakGroups.slice(0, 2).map((item) => (
                <Tag key={item} tone="danger">
                  {item}
                </Tag>
              ))}
            </div>
            <p className="mt-4 text-xs leading-6 text-slate-400">
              {data.status.provider} 기준 · 마지막 스캔 {formatDateTime(data.generatedAt)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="hero-stat">
              <p className="label">Top 3 평균 애프터</p>
              <p className="mt-3 font-mono text-3xl font-semibold text-white">{formatPercent(averageAfterHours)}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">오늘 상위 후보 3개의 장후 반응 평균입니다.</p>
            </div>
            <div className="hero-stat">
              <p className="label">스캔 유니버스</p>
              <p className="mt-3 font-mono text-3xl font-semibold text-white">{data.universeCount}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">S&amp;P500 전체를 먼저 훑은 뒤 상위권만 심화 계산합니다.</p>
            </div>
            <div className="hero-stat">
              <p className="label">오버나이트 백테스트</p>
              <p className="mt-3 font-mono text-3xl font-semibold text-white">
                {strategySummary ? `${strategySummary.gapWinRatePct.toFixed(0)}%` : "-"}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {strategySummary ? `${strategySummary.completedTrades}건 기준 갭 상승 비율` : "마감 스냅샷이 쌓이면 자동 계산됩니다."}
              </p>
            </div>
          </div>
        </div>
      }
    >
      <section className="panel p-5 sm:p-6">
        <div className="flex flex-col gap-4 border-b border-white/6 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="label">Tonight&apos;s Top 3</p>
            <h2 className="panel-title mt-2 text-xl sm:text-2xl">오늘 밤 들고 갈 후보 3종목</h2>
            <p className="panel-subtitle">가장 왼쪽 큰 타일이 최우선입니다. 크기는 우선순위, 배경 강도는 오늘 장후 모멘텀과 이벤트 강도를 뜻합니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Tag tone="info">{countdownLabel(data.marketBrief.closeCountdownMinutes)}</Tag>
            <Tag tone="caution">새로고침 {autoRefresh ? `${settings.autoRefreshSeconds}초` : "수동"}</Tag>
            <Tag tone="positive">{topThree.length}개 표시</Tag>
          </div>
        </div>

        {topThree.length > 0 ? (
          <div className="signal-grid">
            {topThree.map((candidate, index) => (
              <Link
                key={candidate.ticker}
                href={`/stocks/${candidate.ticker}`}
                className={`signal-tile ${tileToneClass(candidate)} ${index === 0 ? "signal-tile-hero" : "signal-tile-side"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="signal-rank-chip">#{index + 1}</span>
                      <span className="label text-slate-200/80">2~3일 관점</span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-end gap-3">
                      <h3 className={`font-semibold tracking-[-0.05em] text-white ${index === 0 ? "text-5xl sm:text-6xl" : "text-4xl"}`}>
                        {candidate.ticker}
                      </h3>
                      <GradeBadge grade={candidate.score.grade} />
                    </div>
                    <p className="mt-2 text-base text-slate-100/80">{candidate.companyName}</p>
                  </div>

                  <div className="signal-score-pill">
                    <span className="label text-slate-300">score</span>
                    <span className="mt-2 block font-mono text-3xl font-semibold text-white">{candidate.score.total.toFixed(1)}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Tag tone={suitabilityTone(candidate.postMarketSuitability)}>{suitabilityLabel(candidate.postMarketSuitability)}</Tag>
                  <Tag tone="neutral">{candidate.sector}</Tag>
                  {candidate.universeTags.slice(0, 2).map((item) => (
                    <Tag key={`${candidate.ticker}-${item}`} tone="info">
                      {item}
                    </Tag>
                  ))}
                </div>

                <p className="signal-copy mt-5">{candidate.coreSummary}</p>

                <div className="signal-stat-grid">
                  <div className="signal-stat">
                    <p className="signal-stat-label">현재가</p>
                    <p className="signal-stat-value">{formatCurrency(candidate.price)}</p>
                    <p className={`signal-stat-copy ${candidate.dayChangePct >= 0 ? "text-emerald-200" : "text-rose-200"}`}>정규장 {formatPercent(candidate.dayChangePct)}</p>
                  </div>
                  <div className="signal-stat">
                    <p className="signal-stat-label">애프터</p>
                    <p className={`signal-stat-value ${candidate.afterHoursChangePct >= 0 ? "text-emerald-100" : "text-rose-100"}`}>
                      {formatPercent(candidate.afterHoursChangePct)}
                    </p>
                    <p className="signal-stat-copy">포스트마켓 반응</p>
                  </div>
                  <div className="signal-stat">
                    <p className="signal-stat-label">RVOL / 마감 30분</p>
                    <p className="signal-stat-value">{candidate.rvol20.toFixed(2)}x</p>
                    <p className="signal-stat-copy">마감 30분 {candidate.close30mVolumeRatio.toFixed(2)}x</p>
                  </div>
                </div>

                <div className={`mt-5 grid gap-3 ${index === 0 ? "md:grid-cols-2" : ""}`}>
                  <div className="signal-note">
                    <p className="label">추천 이유</p>
                    <p className="mt-2 text-sm leading-6 text-slate-100/90">{candidate.reasons[0] ?? candidate.coreSummary}</p>
                  </div>
                  <div className="signal-note">
                    <p className="label">주의 포인트</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200/80">{candidate.risks[0] ?? candidate.overnightRiskNote}</p>
                  </div>
                </div>

                {index === 0 ? (
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <div className="signal-note">
                      <p className="label">시나리오 A</p>
                      <p className="mt-2 text-sm leading-6 text-slate-100/90">{candidate.scenario.primary}</p>
                    </div>
                    <div className="signal-note">
                      <p className="label">시나리오 B</p>
                      <p className="mt-2 text-sm leading-6 text-slate-200/80">{candidate.scenario.alternate}</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="signal-note">
                      <p className="label">진입 아이디어</p>
                      <p className="mt-2 text-sm leading-6 text-slate-100/90">{candidate.entryIdea}</p>
                    </div>
                    <div className="signal-note">
                      <p className="label">청산 아이디어</p>
                      <p className="mt-2 text-sm leading-6 text-slate-200/80">{candidate.exitIdea}</p>
                    </div>
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[26px] border border-white/8 bg-white/4 px-5 py-8 text-sm leading-7 text-slate-300">
            현재 필터에서 보여줄 후보가 없습니다. A급 전용이나 포스트마켓 전용 필터를 잠시 풀고 다시 보세요.
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.94fr_1.06fr]">
        <SectionCard
          title="시장 브리프"
          subtitle="지수, 강한 그룹, 약한 그룹, 예외 종목을 10초 안에 훑는 보드입니다."
          action={<Tag tone={marketTone(data.marketBrief.marketTone)}>{marketToneLabel(data.marketBrief.marketTone)}</Tag>}
        >
          <div className="brief-grid">
            <div className="brief-card">
              <p className="label">지수 흐름</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.marketBrief.indexFlow.map((item) => (
                  <Tag key={item} tone="info">
                    {item}
                  </Tag>
                ))}
              </div>
            </div>

            <div className="brief-card">
              <p className="label">강한 쪽</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.marketBrief.sectorLeaders.map((item) => (
                  <Tag key={item} tone="positive">
                    {item}
                  </Tag>
                ))}
              </div>
            </div>

            <div className="brief-card">
              <p className="label">약한 쪽</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.marketBrief.weakGroups.map((item) => (
                  <Tag key={item} tone="danger">
                    {item}
                  </Tag>
                ))}
              </div>
            </div>

            <div className="brief-card">
              <p className="label">튀는 종목</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.marketBrief.standoutTickers.map((item) => (
                  <Tag key={item} tone="caution">
                    {item}
                  </Tag>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="brief-card">
              <p className="label">오늘 해석</p>
              <p className="mt-3 text-sm leading-7 text-slate-100/90">{data.marketBrief.summary}</p>
            </div>
            <div className="grid gap-3">
              <div className="brief-card">
                <p className="label">시그널 알림</p>
                <div className="mt-3 space-y-2">
                  {data.alerts.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex items-start gap-3 rounded-[16px] border border-white/6 bg-black/10 px-3 py-3">
                      <Tag tone={signalAlertTone(item.severity)}>{item.severity === "high" ? "핵심" : item.severity === "medium" ? "체크" : "참고"}</Tag>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white">{item.title}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-300">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="brief-card">
                <p className="label">체크 리스크</p>
                <div className="mt-3 space-y-2">
                  {data.marketBrief.riskFlags.length > 0 ? (
                    data.marketBrief.riskFlags.slice(0, 3).map((item) => (
                      <div key={item} className="flex items-start gap-3 rounded-[16px] border border-white/6 bg-black/10 px-3 py-3">
                        <Tag tone="danger">주의</Tag>
                        <p className="text-sm leading-6 text-slate-300">{item}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[16px] border border-white/6 bg-black/10 px-3 py-3 text-sm leading-6 text-slate-300">
                      현재 별도 리스크 플래그는 많지 않습니다. 종목별 상세에서 실적 일정과 포스트마켓 체결만 추가 확인하면 됩니다.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="필터 데스크"
          subtitle="마감 직전 빠르게 조건을 좁히는 컨트롤 패널입니다."
          action={<Tag tone="info">{filtered.length}개 보임</Tag>}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="filter-shell text-sm text-slate-300">
              <span className="mb-2 block label">검색</span>
              <input className="filter-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="티커 또는 회사명" />
            </label>

            <div className="filter-shell">
              <span className="mb-2 block label">빠른 토글</span>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-[18px] border border-white/8 bg-black/10 px-3 py-2.5 text-sm text-slate-200">
                  <input type="checkbox" checked={onlyA} onChange={(event) => setOnlyA(event.target.checked)} />
                  A급만 보기
                </label>
                <label className="flex items-center gap-2 rounded-[18px] border border-white/8 bg-black/10 px-3 py-2.5 text-sm text-slate-200">
                  <input type="checkbox" checked={postMarketOnly} onChange={(event) => setPostMarketOnly(event.target.checked)} />
                  포스트마켓 적합만
                </label>
                <label className="sm:col-span-2 flex items-center gap-2 rounded-[18px] border border-white/8 bg-black/10 px-3 py-2.5 text-sm text-slate-200">
                  <input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />
                  자동 새로고침 {autoRefresh ? `ON · ${settings.autoRefreshSeconds}초` : "OFF"}
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="brief-card">
              <p className="label">최소 주가</p>
              <p className="mt-3 font-mono text-2xl font-semibold text-white">{formatCurrency(settings.minPrice)}</p>
            </div>
            <div className="brief-card">
              <p className="label">최소 거래량</p>
              <p className="mt-3 font-mono text-2xl font-semibold text-white">{formatCompactNumber(settings.minAverageVolume)}</p>
            </div>
            <div className="brief-card">
              <p className="label">최소 거래대금</p>
              <p className="mt-3 font-mono text-2xl font-semibold text-white">{settings.minAverageDollarVolumeM.toFixed(0)}M</p>
            </div>
            <div className="brief-card">
              <p className="label">최소 시총</p>
              <p className="mt-3 font-mono text-2xl font-semibold text-white">{settings.minMarketCapBn.toFixed(0)}B</p>
            </div>
          </div>

          {refreshError ? (
            <div className="mt-4 rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{refreshError}</div>
          ) : null}
          {data.status.warning ? (
            <div className="mt-4 rounded-[18px] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{data.status.warning}</div>
          ) : null}
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard
          title="오늘 밤 실행 데스크"
          subtitle="Top 3를 다시 늘어놓는 대신, 어디서 진입하고 무엇을 확인하고 언제 털지까지 한 번에 비교하는 구역입니다."
          action={<Tag tone="positive">{topThree.length}개 플랜</Tag>}
        >
          <div className="execution-grid">
            {topThree.map((candidate, index) => (
              <Link key={candidate.ticker} href={`/stocks/${candidate.ticker}`} className="execution-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="signal-rank-chip">#{index + 1}</span>
                      <h3 className="text-2xl font-semibold tracking-[-0.05em] text-white">{candidate.ticker}</h3>
                      <GradeBadge grade={candidate.score.grade} />
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{candidate.companyName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-3xl font-semibold text-white">{candidate.score.total.toFixed(1)}</p>
                    <p className={`mt-2 text-sm font-medium ${candidate.afterHoursChangePct >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      애프터 {formatPercent(candidate.afterHoursChangePct)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="brief-card">
                    <p className="label">진입</p>
                    <p className="mt-3 text-sm leading-7 text-slate-100">{candidate.entryIdea}</p>
                  </div>
                  <div className="brief-card">
                    <p className="label">시나리오</p>
                    <p className="mt-3 text-sm leading-7 text-slate-100">{candidate.scenario.primary}</p>
                  </div>
                  <div className="brief-card">
                    <p className="label">청산</p>
                    <p className="mt-3 text-sm leading-7 text-slate-100">{candidate.exitIdea}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="candidate-metric">
                    <p className="label">현재가</p>
                    <p className="mt-2 font-mono text-xl font-semibold text-white">{formatCurrency(candidate.price)}</p>
                  </div>
                  <div className="candidate-metric">
                    <p className="label">정규장 / RVOL</p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {formatPercent(candidate.dayChangePct)} / {candidate.rvol20.toFixed(2)}x
                    </p>
                  </div>
                  <div className="candidate-metric">
                    <p className="label">지지 / 저항</p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {formatCurrency(candidate.supportLevel)} / {formatCurrency(candidate.resistanceLevel)}
                    </p>
                  </div>
                  <div className="candidate-metric">
                    <p className="label">실적 / 백테스트</p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {candidate.daysToEarnings}일 / 갭업 {candidate.backtest.gapUpRatePct.toFixed(0)}%
                    </p>
                  </div>
                </div>

                <div className="mt-4 execution-risk">
                  <p className="label">체크 포인트</p>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{candidate.overnightRiskNote}</p>
                </div>
              </Link>
            ))}
          </div>

          {nearMisses.length > 0 ? (
            <div className="mt-5 rounded-[26px] border border-white/8 bg-white/4 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="label">근접 감시</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Top 3 바로 아래에서 대기 중인 종목입니다. 장후 체결이나 뉴스가 더 붙으면 교체 후보가 됩니다.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {nearMisses.map((candidate) => (
                    <Link key={candidate.ticker} href={`/stocks/${candidate.ticker}`} className="checkpoint-chip">
                      <span className="font-semibold text-white">{candidate.ticker}</span>
                      <span className="text-slate-300">{candidate.score.total.toFixed(1)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard
          title="어제 후보 성적표"
          subtitle="전일 종가베팅 후보가 익일 장중에 실제로 잘 뛰었는지, 지금 시점 기준으로 바로 확인하는 리플레이 보드입니다."
          action={
            data.previousReview ? (
              <Tag tone="info">{formatDate(data.previousReview.sessionDate)}</Tag>
            ) : (
              <Tag tone="caution">데이터 대기</Tag>
            )
          }
        >
          {data.previousReview ? (
            <div className="space-y-4">
              <div className="brief-card">
                <p className="label">요약</p>
                <p className="mt-3 text-sm leading-7 text-slate-100">{data.previousReview.summary}</p>
              </div>

              <div className="review-grid">
                {data.previousReview.candidates.map((candidate) => (
                  <div key={candidate.ticker} className="review-card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-2xl font-semibold tracking-[-0.05em] text-white">{candidate.ticker}</h3>
                          <GradeBadge grade={candidate.grade} />
                          <Tag tone={outcomeTone(candidate.outcome)}>{outcomeLabel(candidate.outcome)}</Tag>
                        </div>
                        <p className="mt-2 text-sm text-slate-400">{candidate.companyName}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-2xl font-semibold text-white">{candidate.score.toFixed(1)}</p>
                        <p className="mt-1 text-xs text-slate-400">전일 점수</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="candidate-metric">
                        <p className="label">전일 종가</p>
                        <p className="mt-2 font-mono text-lg font-semibold text-white">{formatCurrency(candidate.close)}</p>
                      </div>
                      <div className="candidate-metric">
                        <p className="label">현재가</p>
                        <p className="mt-2 font-mono text-lg font-semibold text-white">{formatCurrency(candidate.currentPrice)}</p>
                      </div>
                      <div className="candidate-metric">
                        <p className="label">갭 / 현재</p>
                        <p className="mt-2 text-sm font-semibold text-white">
                          {formatPercent(candidate.gapPct)} / {formatPercent(candidate.currentMovePct)}
                        </p>
                      </div>
                      <div className="candidate-metric">
                        <p className="label">장중 최고</p>
                        <p className="mt-2 text-sm font-semibold text-white">{formatPercent(candidate.highPct)}</p>
                      </div>
                    </div>

                    <div className="mt-4 review-summary">
                      <p className="label">판정 코멘트</p>
                      <p className="mt-2 text-sm leading-7 text-slate-300">{candidate.summary}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] border border-white/8 bg-white/4 px-4 py-4 text-sm leading-7 text-slate-300">
              아직 비교할 전일 스냅샷이 없습니다. 장마감 직전 한 번 스캔이 저장되면 다음 날부터 자동으로 성공/실패 성적표가 쌓입니다.
            </div>
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}
