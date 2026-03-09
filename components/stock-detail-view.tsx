import Link from "next/link";
import { PriceChart } from "@/components/price-chart";
import { Badge, Panel, ScoreBadge } from "@/components/ui";
import { StockDetailData } from "@/lib/types";
import { formatCurrency, formatDate, formatPercent } from "@/lib/utils";

export function StockDetailView({ data }: { data: StockDetailData }) {
  const { candidate } = data;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/" className="text-sm text-cyan-300 transition hover:text-cyan-200">← Back to dashboard</Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="info">{candidate.profile.sector}</Badge>
            <Badge tone={candidate.label === "Avoid" ? "danger" : candidate.label === "Earnings watch" ? "caution" : "positive"}>{candidate.label}</Badge>
            <ScoreBadge score={candidate.score.finalScore} />
          </div>
          <h1 className="mt-3 text-4xl text-slate-50 sm:text-5xl">{candidate.profile.companyName} ({candidate.profile.ticker})</h1>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">{candidate.profile.description}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="panel-muted p-3">
            <p className="label">Price</p>
            <p className="mt-1 text-xl font-semibold">{formatCurrency(candidate.quote.price)}</p>
            <p className="text-xs text-slate-400">1D {formatPercent(candidate.quote.change1dPct)}</p>
          </div>
          <div className="panel-muted p-3">
            <p className="label">52W High</p>
            <p className="mt-1 text-xl font-semibold">{formatCurrency(candidate.technicals.high52w)}</p>
            <p className="text-xs text-slate-400">{candidate.technicals.distanceFromHighPct.toFixed(1)}% below</p>
          </div>
          <div className="panel-muted p-3">
            <p className="label">Relative Strength</p>
            <p className="mt-1 text-xl font-semibold">{candidate.technicals.relativeStrengthLine.toFixed(1)}</p>
            <p className="text-xs text-slate-400">vs S&P proxy</p>
          </div>
          <div className="panel-muted p-3">
            <p className="label">Next Earnings</p>
            <p className="mt-1 text-xl font-semibold">{formatDate(candidate.earnings.nextEarningsDate)}</p>
            <p className="text-xs text-slate-400">{candidate.earnings.summary}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Price Trend & Volume" subtitle="90-session context for a swing workflow.">
          <PriceChart history={candidate.priceHistory} />
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="panel-muted p-3">
              <p className="label">MA20</p>
              <p className="mt-1 text-lg font-semibold">{formatCurrency(candidate.technicals.ma20)}</p>
            </div>
            <div className="panel-muted p-3">
              <p className="label">MA50</p>
              <p className="mt-1 text-lg font-semibold">{formatCurrency(candidate.technicals.ma50)}</p>
            </div>
            <div className="panel-muted p-3">
              <p className="label">MA200</p>
              <p className="mt-1 text-lg font-semibold">{formatCurrency(candidate.technicals.ma200)}</p>
            </div>
            <div className="panel-muted p-3">
              <p className="label">Volume Ratio</p>
              <p className="mt-1 text-lg font-semibold">{candidate.technicals.volumeRatio.toFixed(2)}x</p>
            </div>
          </div>
        </Panel>

        <Panel title="Research Thesis" subtitle="Why it matters, why it may still be premature, and how to validate it.">
          <div className="grid gap-3">
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4">
              <p className="label">Why Watching</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                {candidate.narrative.whyWatch.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
            <div className="rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4">
              <p className="label">Why Not Yet</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                {candidate.narrative.whyNotYet.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
            <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
              <p className="label">What Confirms It</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                {candidate.narrative.confirmation.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
            <div className="rounded-2xl border border-rose-400/15 bg-rose-400/5 p-4">
              <p className="label">What Invalidates It</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                {candidate.narrative.invalidation.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          </div>
        </Panel>

        <Panel title="Score Breakdown" subtitle="Deterministic model components. Adjust weights in config without touching the UI.">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["Macro fit", candidate.score.macroFit],
              ["Sector strength", candidate.score.sectorStrength],
              ["Theme strength", candidate.score.themeStrength],
              ["Earnings/news", candidate.score.earningsNews],
              ["Price structure", candidate.score.priceStructure],
              ["Flow/volume", candidate.score.flowVolume],
              ["Valuation sanity", candidate.score.valuationSanity],
              ["Risk penalty", candidate.score.riskPenalty]
            ].map(([label, value]) => (
              <div key={label} className="panel-muted p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-300">{label}</span>
                  <span className="text-sm font-semibold text-slate-50">{Number(value).toFixed(1)}</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/6">
                  <div className={`h-2 rounded-full ${label === "Risk penalty" ? "bg-gradient-to-r from-rose-300 to-rose-500" : "bg-gradient-to-r from-cyan-300 to-emerald-300"}`} style={{ width: `${Math.min(Number(value), 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Bullish / Bearish / Next" subtitle="AI is used only for explanation, not scoring.">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4">
              <p className="label">Bullish Factors</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                {candidate.narrative.bullishFactors.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
            <div className="rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4">
              <p className="label">Bearish Factors</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                {candidate.narrative.bearishFactors.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
            <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
              <p className="label">What To Watch Next</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
                {candidate.narrative.whatToWatchNext.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          </div>
        </Panel>

        <Panel title="Recent News" subtitle="De-duplicated headlines tied back to the stock.">
          <div className="space-y-3">
            {candidate.recentNews.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-50">{item.title}</p>
                  <span className="text-xs text-slate-500">{formatDate(item.publishedAt)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{item.summary}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Event Calendar & Peers" subtitle="Catalyst map plus same-sector alternatives.">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-3">
              {candidate.eventCalendar.map((event) => (
                <div key={event.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="font-medium text-slate-50">{event.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{formatDate(event.date)}</p>
                  <p className="mt-2 text-sm text-slate-300">{event.note}</p>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {data.peerCandidates.map((peer) => (
                <Link key={peer.profile.ticker} href={`/stocks/${peer.profile.ticker}`} className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-cyan-400/30 hover:bg-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-50">{peer.profile.ticker}</p>
                      <p className="text-sm text-slate-300">{peer.narrative.whyWatch[0]}</p>
                    </div>
                    <ScoreBadge score={peer.score.finalScore} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </main>
  );
}
