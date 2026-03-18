"use client";

import { useEffect, useState } from "react";
import { defaultOvernightSettings, normalizeOvernightSettings } from "@/lib/overnight-defaults";
import { OvernightDashboardData } from "@/lib/overnight-types";
import { OvernightDashboardClient } from "@/components/overnight-dashboard-client";
import { OvernightDashboardLoadingShell } from "@/components/overnight-dashboard-loading-shell";
import { OvernightIntroSplash } from "@/components/overnight-intro-splash";
import { AppShell, SectionCard } from "@/components/overnight-ui";
import { loadClientOvernightSnapshots } from "@/lib/overnight-client-storage";

const SETTINGS_STORAGE_KEY = "overnight-close-bet-settings";

function loadStoredSettings() {
  if (typeof window === "undefined") {
    return defaultOvernightSettings;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return defaultOvernightSettings;
    }

    return normalizeOvernightSettings(JSON.parse(raw));
  } catch {
    return defaultOvernightSettings;
  }
}

type LoadState =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: OvernightDashboardData; error: null }
  | { status: "error"; data: null; error: string };

export function OvernightDashboardBootClient() {
  const [showIntro, setShowIntro] = useState(true);
  const [state, setState] = useState<LoadState>({ status: "loading", data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    const introTimer = window.setTimeout(() => {
      if (!cancelled) {
        setShowIntro(false);
      }
    }, 1400);

    async function load() {
      try {
        const settings = loadStoredSettings();
        const response = await fetch("/api/scan", {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ settings, clientSnapshotHistory: loadClientOvernightSnapshots(settings.syncKey) })
        });
        const payload = (await response.json().catch(() => ({}))) as { data?: OvernightDashboardData; error?: string };

        if (cancelled) {
          return;
        }

        if (!response.ok || !payload.data) {
          setState({
            status: "error",
            data: null,
            error: payload.error ?? "종가베팅 스캔 데이터를 불러오지 못했습니다."
          });
          return;
        }

        setState({ status: "ready", data: payload.data, error: null });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          status: "error",
          data: null,
          error: error instanceof Error ? error.message : "종가베팅 스캔 데이터를 불러오지 못했습니다."
        });
      }
    }

    void load();

    return () => {
      cancelled = true;
      window.clearTimeout(introTimer);
    };
  }, []);

  if (showIntro) {
    return <OvernightIntroSplash />;
  }

  if (state.status === "ready") {
    return <OvernightDashboardClient initialData={state.data} />;
  }

  if (state.status === "error") {
    return (
      <AppShell
        title="S&P500 종가베팅 스캐너"
        subtitle="초기 스캔 응답을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
      >
        <SectionCard title="로드 실패">
          <p className="text-sm leading-6 text-rose-100">{state.error}</p>
        </SectionCard>
      </AppShell>
    );
  }

  return <OvernightDashboardLoadingShell />;
}
