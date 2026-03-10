"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { DashboardLoadingShell } from "@/components/dashboard-loading-shell";
import { LiveRequiredPanel } from "@/components/live-required-panel";
import { DashboardData } from "@/lib/types";

const DashboardClient = dynamic(
  () => import("@/components/dashboard-client").then((module) => module.DashboardClient),
  {
    ssr: false,
    loading: () => <DashboardLoadingShell message="대시보드 화면을 불러오는 중입니다." />
  }
);

type LoadState =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: DashboardData; error: null }
  | { status: "error"; data: null; error: { title: string; detail: string } };

export function DashboardBootClient() {
  const [state, setState] = useState<LoadState>({ status: "loading", data: null, error: null });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });
        const payload = (await response.json()) as { data?: DashboardData; error?: string };

        if (cancelled) {
          return;
        }

        if (!response.ok || !payload.data) {
          setState({
            status: "error",
            data: null,
            error: {
              title:
                response.status === 503
                  ? "실시간 데이터 연결이 아직 준비되지 않았습니다."
                  : "실시간 대시보드를 불러오는 중 오류가 발생했습니다.",
              detail: payload.error ?? "서버에서 예상하지 못한 오류가 발생했습니다."
            }
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
          error: {
            title: "실시간 대시보드를 불러오는 중 오류가 발생했습니다.",
            detail: error instanceof Error ? error.message : "서버에서 예상하지 못한 오류가 발생했습니다."
          }
        });
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "ready") {
    return <DashboardClient initialData={state.data} />;
  }

  if (state.status === "error") {
    return <LiveRequiredPanel title={state.error.title} detail={state.error.detail} />;
  }

  return <DashboardLoadingShell />;
}
