"use client";

import { useMemo, useState } from "react";
import { defaultOvernightSettings } from "@/lib/overnight-defaults";
import { OvernightSettings } from "@/lib/overnight-types";
import { AppShell, SectionCard, Tag } from "@/components/overnight-ui";

const STORAGE_KEY = "overnight-close-bet-settings";

export function OvernightSettingsClient() {
  const [settings, setSettings] = useState<OvernightSettings>(() => {
    if (typeof window === "undefined") {
      return defaultOvernightSettings;
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return defaultOvernightSettings;
    }

    try {
      const parsed = JSON.parse(stored) as Partial<OvernightSettings>;
      return {
        ...defaultOvernightSettings,
        ...parsed,
        weights: {
          ...defaultOvernightSettings.weights,
          ...parsed.weights
        }
      };
    } catch {
      return defaultOvernightSettings;
    }
  });
  const [saved, setSaved] = useState(false);

  const totalWeight = useMemo(() => {
    return Object.values(settings.weights).reduce((sum, value) => sum + value, 0);
  }, [settings.weights]);

  function saveSettings() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <AppShell
      title="종가베팅 설정"
      subtitle="기본 필터, 뉴스/섹터 가중치, 실적 제외 여부, 포스트마켓 허용 여부까지 전략에 맞게 조정할 수 있습니다."
      right={
        <div className="hero-stat">
          <p className="label">가중치 합계</p>
          <p className="mt-2 text-4xl font-semibold text-white">{totalWeight}</p>
          <p className="mt-2 text-sm text-slate-300">100을 권장하지만, 실험용으로 다르게 둘 수도 있습니다.</p>
          {saved ? (
            <div className="mt-4">
              <Tag tone="positive">저장 완료</Tag>
            </div>
          ) : null}
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <SectionCard title="기본 필터" subtitle="MVP 기본 스캔 조건입니다.">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">최소 주가</span>
              <input
                type="number"
                value={settings.minPrice}
                onChange={(event) => setSettings((current) => ({ ...current, minPrice: Number(event.target.value) }))}
                className="filter-input"
              />
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">최소 거래량</span>
              <input
                type="number"
                value={settings.minAverageVolume}
                onChange={(event) => setSettings((current) => ({ ...current, minAverageVolume: Number(event.target.value) }))}
                className="filter-input"
              />
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">최소 거래대금(M)</span>
              <input
                type="number"
                value={settings.minAverageDollarVolumeM}
                onChange={(event) => setSettings((current) => ({ ...current, minAverageDollarVolumeM: Number(event.target.value) }))}
                className="filter-input"
              />
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">최소 시총(B)</span>
              <input
                type="number"
                value={settings.minMarketCapBn}
                onChange={(event) => setSettings((current) => ({ ...current, minMarketCapBn: Number(event.target.value) }))}
                className="filter-input"
              />
            </label>
          </div>
        </SectionCard>

        <SectionCard title="전략 토글" subtitle="실적 일정과 포스트마켓 허용 여부를 빠르게 켜고 끌 수 있습니다.">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 rounded-[18px] border border-white/8 bg-black/10 px-3 py-2.5 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={settings.onlyAGrade}
                onChange={(event) => setSettings((current) => ({ ...current, onlyAGrade: event.target.checked }))}
              />
              A급만 기본 표시
            </label>
            <label className="flex items-center gap-2 rounded-[18px] border border-white/8 bg-black/10 px-3 py-2.5 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={settings.excludeUpcomingEarnings}
                onChange={(event) => setSettings((current) => ({ ...current, excludeUpcomingEarnings: event.target.checked }))}
              />
              실적 발표 임박 종목 제외
            </label>
            <label className="flex items-center gap-2 rounded-[18px] border border-white/8 bg-black/10 px-3 py-2.5 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={settings.allowPostMarket}
                onChange={(event) => setSettings((current) => ({ ...current, allowPostMarket: event.target.checked }))}
              />
              포스트마켓 매수 허용
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">자동 새로고침(초)</span>
              <input
                type="number"
                value={settings.autoRefreshSeconds}
                onChange={(event) => setSettings((current) => ({ ...current, autoRefreshSeconds: Number(event.target.value) }))}
                className="filter-input"
              />
            </label>
          </div>
        </SectionCard>

        <SectionCard title="가중치 조정" subtitle="총점 100 기준이지만, 실험을 위해 직접 바꿀 수 있습니다.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(settings.weights).map(([key, value]) => (
              <label key={key} className="text-sm text-slate-300">
                <span className="mb-1 block">{key}</span>
                <input
                  type="number"
                  value={value}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      weights: {
                        ...current.weights,
                        [key]: Number(event.target.value)
                      }
                    }))
                  }
                  className="filter-input"
                />
              </label>
            ))}
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">뉴스 가중치 배수</span>
              <input
                type="number"
                step="0.1"
                value={settings.newsWeightMultiplier}
                onChange={(event) => setSettings((current) => ({ ...current, newsWeightMultiplier: Number(event.target.value) }))}
                className="filter-input"
              />
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">섹터 가중치 배수</span>
              <input
                type="number"
                step="0.1"
                value={settings.sectorWeightMultiplier}
                onChange={(event) => setSettings((current) => ({ ...current, sectorWeightMultiplier: Number(event.target.value) }))}
                className="filter-input"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={saveSettings} className="primary-action">
              설정 저장
            </button>
            <button type="button" onClick={() => setSettings(defaultOvernightSettings)} className="subtle-action">
              기본값 복원
            </button>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
