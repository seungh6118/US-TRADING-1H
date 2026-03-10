import { ReactNode } from "react";

type PanelProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

const badgeStyles = {
  neutral: "border-white/10 bg-white/5 text-slate-200",
  positive: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
  caution: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  danger: "border-rose-400/20 bg-rose-400/10 text-rose-200",
  info: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
} as const;

export function Panel({ title, subtitle, action, children, className = "" }: PanelProps) {
  return (
    <section className={`panel p-5 sm:p-6 ${className}`}>
      <div className="mb-5 flex items-start justify-between gap-4 border-b border-white/6 pb-4">
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

export function Badge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: keyof typeof badgeStyles;
}) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${badgeStyles[tone]}`}>{children}</span>;
}

export function ScoreBadge({ score }: { score: number }) {
  const tone = score >= 75 ? "positive" : score >= 58 ? "info" : score >= 45 ? "caution" : "danger";
  return <Badge tone={tone}>{score.toFixed(1)}</Badge>;
}
