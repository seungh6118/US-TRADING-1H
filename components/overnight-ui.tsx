import Link from "next/link";
import { ReactNode } from "react";

export function AppShell({
  children,
  title,
  subtitle,
  right
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
  right?: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <section className="hero-panel mb-6">
        <div className="grid gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-8">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Link href="/" className="pill">
                종가베팅 대시보드
              </Link>
              <Link href="/settings" className="pill">
                설정
              </Link>
              <span className="pill">미국장 마감 10~15분 전 전용</span>
            </div>
            <h1 className="max-w-4xl text-4xl leading-tight text-slate-50 sm:text-5xl lg:text-[3.15rem]">{title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-200/90">{subtitle}</p>
          </div>
          {right}
        </div>
      </section>
      {children}
    </main>
  );
}

export function SectionCard({
  title,
  subtitle,
  children,
  action
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="panel p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4 border-b border-white/6 pb-4">
        <div className="min-w-0">
          <p className="label">패널</p>
          <h2 className="panel-title mt-2">{title}</h2>
          {subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Tag({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "caution" | "danger" | "info";
}) {
  const tones = {
    neutral: "border-white/10 bg-white/5 text-slate-200",
    positive: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    caution: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    danger: "border-rose-400/20 bg-rose-400/10 text-rose-200",
    info: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
  } as const;

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function GradeBadge({ grade }: { grade: string }) {
  const tone = grade === "A" ? "positive" : grade === "B" ? "info" : grade === "C" ? "caution" : "danger";
  return <Tag tone={tone}>{grade}급</Tag>;
}

export function ScoreBar({
  label,
  value,
  max,
  tone = "cyan"
}: {
  label: string;
  value: number;
  max: number;
  tone?: "cyan" | "emerald" | "amber" | "rose";
}) {
  const width = Math.max(0, Math.min(100, (value / max) * 100));
  const gradient =
    tone === "emerald"
      ? "from-emerald-400 to-teal-300"
      : tone === "amber"
        ? "from-amber-400 to-yellow-300"
        : tone === "rose"
          ? "from-rose-400 to-pink-300"
          : "from-cyan-400 to-blue-300";

  return (
    <div className="candidate-metric">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="label">{label}</p>
        <p className="text-sm font-semibold text-white">{value.toFixed(1)}</p>
      </div>
      <div className="h-2 rounded-full bg-white/6">
        <div className={`h-2 rounded-full bg-gradient-to-r ${gradient}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
