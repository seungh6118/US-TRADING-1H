import type { CSSProperties } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { displayCandidateLabel, displaySector, displayTheme } from "@/lib/localization";
import { CandidateStock } from "@/lib/types";
import { formatCurrency, formatPercent } from "@/lib/utils";

function tileTone(candidate: CandidateStock) {
  const score = candidate.score.finalScore;
  const day = candidate.quote.change1dPct;
  const week = candidate.quote.change5dPct;

  if (score >= 78 || day >= 5 || week >= 9) {
    return "heat-tile-positive-strong";
  }
  if (score >= 64 || day >= 2 || week >= 4) {
    return "heat-tile-positive";
  }
  if (score <= 46 || day <= -4 || week <= -7) {
    return "heat-tile-negative-strong";
  }
  if (score <= 55 || day < 0) {
    return "heat-tile-negative";
  }
  return "heat-tile-neutral";
}

function tileSpan(index: number) {
  if (index === 0) {
    return "md:col-span-2 md:row-span-2";
  }
  if (index === 1 || index === 2) {
    return "md:col-span-2";
  }
  return "md:col-span-1";
}

function convictionTone(score: number) {
  if (score >= 80) {
    return "positive" as const;
  }
  if (score >= 68) {
    return "info" as const;
  }
  return "caution" as const;
}

function clampStyle(lines: number): CSSProperties {
  return {
    display: "-webkit-box",
    WebkitLineClamp: lines,
    WebkitBoxOrient: "vertical",
    overflow: "hidden"
  };
}

export function CandidateHeatmap({ candidates }: { candidates: CandidateStock[] }) {
  const items = candidates.slice(0, 10);

  return (
    <div className="grid auto-rows-[138px] grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
      {items.map((candidate, index) => {
        const showNarrative = index < 3;
        const showThemes = index < 5;

        return (
          <Link
            key={candidate.profile.ticker}
            href={`/stocks/${candidate.profile.ticker}`}
            className={`heat-tile ${tileTone(candidate)} ${tileSpan(index)}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-200/65">
                  <span>우선순위 #{index + 1}</span>
                  <span>2~3일 관점</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="truncate text-xl font-semibold tracking-[-0.03em] text-white">{candidate.profile.ticker}</span>
                  <Badge tone={candidate.quote.change1dPct >= 0 ? "positive" : "danger"}>{formatPercent(candidate.quote.change1dPct)}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-200/90" style={clampStyle(showNarrative ? 2 : 1)}>
                  {candidate.profile.companyName}
                </p>
              </div>
              <Badge tone={convictionTone(candidate.score.finalScore)}>점수 {candidate.score.finalScore.toFixed(1)}</Badge>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-slate-100">{displaySector(candidate.profile.sector)}</span>
              <span className="rounded-full bg-black/15 px-2.5 py-1 text-[11px] text-slate-100">{displayCandidateLabel(candidate.label)}</span>
              {showThemes
                ? candidate.profile.themes.slice(0, 2).map((theme) => (
                    <span key={theme} className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] text-slate-200">
                      {displayTheme(theme)}
                    </span>
                  ))
                : null}
            </div>

            {showNarrative ? (
              <div className="mt-auto grid gap-3 sm:grid-cols-[110px_minmax(0,1fr)]">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-200/70">현재가</p>
                  <p className="mt-1 text-lg font-semibold text-white">{formatCurrency(candidate.quote.price)}</p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-200/70">단기 핵심 근거</p>
                  <p className="mt-1 text-sm leading-5 text-slate-100/90" style={clampStyle(index === 0 ? 4 : 2)}>
                    {candidate.narrative.whyWatch[0]}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-auto flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-200/70">현재가</p>
                  <p className="mt-1 text-lg font-semibold text-white">{formatCurrency(candidate.quote.price)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-200/70">5일</p>
                  <p className={`mt-1 text-sm font-semibold ${candidate.quote.change5dPct >= 0 ? "text-emerald-200" : "text-rose-200"}`}>
                    {formatPercent(candidate.quote.change5dPct)}
                  </p>
                </div>
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
