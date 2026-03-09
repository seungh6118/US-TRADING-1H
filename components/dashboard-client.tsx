"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState, useTransition } from "react";
import { defaultFilters } from "@/lib/config";
import { universeDefinitions } from "@/lib/constants";
import { DashboardData, SavedWatchlistItem, UniverseKey } from "@/lib/types";
import { formatCurrency, formatDate, formatDateTime, formatPercent } from "@/lib/utils";
import { Badge, Panel, ScoreBadge } from "@/components/ui";

function regimeTone(regime: DashboardData["market"]["regime"]) {
  if (regime === "risk-on") {
    return "positive" as const;
  }
  if (regime === "risk-off") {
    return "danger" as const;
  }
  return "caution" as const;
}

function watchlistDeltaTone(value: number) {
  if (value > 0) {
    return "text-emerald-300";
  }
  if (value < 0) {
    return "text-rose-300";
  }
  return "text-slate-300";
}

export function DashboardClient({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState(initialData);
  const [universe, setUniverse] = useState<UniverseKey>(initialData.universe);
  const [customTickerInput, setCustomTickerInput] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(defaultFilters);
  const [saved, setSaved] = useState<SavedWatchlistItem[]>(initialData.watchlist.saved);
  const [isPending, startTransition] = useTransition();
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setSaved(data.watchlist.saved);
    setUniverse(data.universe);
  }, [data]);

  const savedTickers = new Set(saved.map((item) => item.ticker));
  const filteredCandidates = data.candidates.filter((candidate) => {
    const searchPass =
      deferredSearch.trim().length === 0 ||
      candidate.profile.ticker.toLowerCase().includes(deferredSearch.toLowerCase()) ||
      candidate.profile.companyName.toLowerCase().includes(deferredSearch.toLowerCase());
    const marketCapPass = candidate.fundamentals.marketCapBn >= filters.marketCapMinBn;
    const volumePass = candidate.fundamentals.averageDollarVolumeM >= filters.averageDollarVolumeMinM;
    const sectorPass = filters.sector === "All" || candidate.profile.sector === filters.sector;
    const volatilityPass = candidate.technicals.atrPct <= filters.volatilityMaxPct;
    const earningsPass = !filters.excludeEarningsWindow || new Date(candidate.earnings.nextEarningsDate).getTime() - Date.now() > 7 * 86400000;
    return searchPass && marketCapPass && volumePass && sectorPass && volatilityPass && earningsPass;
  });

  const sectorOptions = ["All", ...Array.from(new Set(data.candidates.map((candidate) => candidate.profile.sector)))];
  const snapshotMap = new Map(data.watchlist.items.map((item) => [item.ticker, item]));
  const myWatchlistRows = saved
    .map((item) => {
      const match = data.candidates.find((candidate) => candidate.profile.ticker === item.ticker);
      const snapshot = snapshotMap.get(item.ticker);
      return match || snapshot ? { saved: item, candidate: match, snapshot } : null;
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  async function loadDashboard(nextUniverse: UniverseKey, custom = customTickerInput) {
    const params = new URLSearchParams({ universe: nextUniverse });
    if (nextUniverse === "custom" && custom.trim()) {
      params.set("custom", custom.trim());
    }

    const response = await fetch(`/api/dashboard?${params.toString()}`, { cache: "no-store" });
    const payload = (await response.json()) as { data: DashboardData };
    setData(payload.data);
  }

  function handleUniverseChange(nextUniverse: UniverseKey) {
    setUniverse(nextUniverse);
    if (nextUniverse === "custom") {
      return;
    }
    startTransition(() => {
      void loadDashboard(nextUniverse);
    });
  }

  function handleCustomUniverse() {
    startTransition(() => {
      void loadDashboard("custom", customTickerInput);
    });
  }

  function handleToggleWatchlist(ticker: string) {
    startTransition(async () => {
      const response = await fetch("/api/watchlist/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ticker })
      });
      const payload = (await response.json()) as { data: SavedWatchlistItem[] };
      setSaved(payload.data);
    });
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="info">US Stock AI Research Radar</Badge>
            <Badge tone={regimeTone(data.market.regime)}>{data.market.regime}</Badge>
            <Badge tone={data.status.runtimeMode === "mock" ? "caution" : "positive"}>{data.status.runtimeMode}</Badge>
          </div>
          <h1 className="max-w-3xl text-4xl text-slate-50 sm:text-5xl">Explainable US swing research for a Korea-based workflow.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            {data.status.note} Generated {formatDateTime(data.generatedAt)}. The goal is not instant buy calls. The goal is to compress the tape into names worth checking today and this week.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div className="panel-muted p-3">
            <p className="label">Actionable</p>
            <p className="mt-1 text-2xl font-semibold">{data.topActionable.length}</p>
          </div>
          <div className="panel-muted p-3">
            <p className="label">Watchlist</p>
            <p className="mt-1 text-2xl font-semibold">{data.watchlist.items.length}</p>
          </div>
          <div className="panel-muted p-3">
            <p className="label">Risk Alerts</p>
            <p className="mt-1 text-2xl font-semibold">{data.riskAlerts.length}</p>
          </div>
          <div className="panel-muted p-3">
            <p className="label">Universe</p>
            <p className="mt-1 text-xl font-semibold">{data.candidates.length}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-3">
        <Panel title="Today's Top 3 Actionable Names" subtitle="High-score names with the cleanest current structure.">
          <div className="space-y-3">
            {data.topActionable.map((candidate) => (
              <Link key={candidate.profile.ticker} href={`/stocks/${candidate.profile.ticker}`} className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-cyan-400/30 hover:bg-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">{candidate.profile.ticker}</span>
                      <Badge tone="positive">{candidate.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-300">{candidate.narrative.whyWatch[0]}</p>
                  </div>
                  <ScoreBadge score={candidate.score.finalScore} />
                </div>
              </Link>
            ))}
          </div>
        </Panel>
        <Panel title="Top 5 Watchlist Names" subtitle="Daily AI-generated snapshot for quick checking.">
          <div className="space-y-3">
            {data.watchlist.items.slice(0, 5).map((item) => (
              <div key={item.ticker} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{item.ticker}</span>
                    {item.isNew ? <Badge tone="info">new</Badge> : null}
                  </div>
                  <span className={`text-sm font-medium ${watchlistDeltaTone(item.deltaFromPrior)}`}>{item.deltaFromPrior >= 0 ? "+" : ""}{item.deltaFromPrior.toFixed(1)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{item.reason}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Avoid List 3" subtitle="Names where current reward-to-risk looks weak.">
          <div className="space-y-3">
            {data.avoidList.map((candidate) => (
              <div key={candidate.profile.ticker} className="rounded-2xl border border-rose-400/15 bg-rose-400/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{candidate.profile.ticker}</span>
                      <Badge tone="danger">Avoid</Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{candidate.narrative.whyNotYet[0]}</p>
                  </div>
                  <ScoreBadge score={candidate.score.finalScore} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr] xl:grid-cols-[1.2fr_0.8fr]">
        <Panel
          title="Market Regime Summary"
          subtitle={data.market.aiSummary}
          className="lg:col-span-1"
          action={<span className="pill">{data.market.regime}</span>}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {data.market.indices.concat(data.market.macroAssets).map((item) => (
              <div key={item.symbol} className="panel-muted p-4">
                <p className="label">{item.name}</p>
                <p className="mt-1 text-xl font-semibold">{item.value.toLocaleString()}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                  <span>{formatPercent(item.change1dPct)}</span>
                  <span className="text-slate-500">5D {formatPercent(item.change5dPct)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {data.market.economicEvents.map((event) => (
              <div key={event.id} className="rounded-2xl border border-white/10 bg-surface-800/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{event.title}</p>
                  <Badge tone={event.impact === "high" ? "danger" : event.impact === "medium" ? "caution" : "neutral"}>{event.impact}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-400">{formatDate(event.date)}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{event.note}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Strong Sectors / Themes" subtitle={data.themeSummary}>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-medium text-slate-300">Sector Relative Strength</p>
              <div className="space-y-3">
                {data.sectors.slice(0, 5).map((sector) => (
                  <div key={sector.sector}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{sector.sector}</span>
                      <span className="text-slate-300">{sector.score}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/6">
                      <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300" style={{ width: `${sector.score}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">5D {formatPercent(sector.performance5dPct)} / 20D {formatPercent(sector.performance20dPct)} / 60D {formatPercent(sector.performance60dPct)}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-3 text-sm font-medium text-slate-300">Theme Momentum</p>
              <div className="space-y-3">
                {data.themes.slice(0, 5).map((theme) => (
                  <div key={theme.name} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{theme.name}</p>
                        <p className="text-xs text-slate-400">{theme.newsMentions} mentions · sentiment {theme.sentimentScore}</p>
                      </div>
                      <ScoreBadge score={theme.score} />
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{theme.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <Panel
          title="Top Stock Candidates"
          subtitle="Explainable, score-based ranking. Use filters to narrow swing candidates rather than blindly chasing the tape."
          className="lg:col-span-1 xl:col-span-1"
          action={isPending ? <Badge tone="info">Refreshing...</Badge> : <Badge tone="neutral">{filteredCandidates.length} shown</Badge>}
        >
          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">Universe</span>
              <select value={universe} onChange={(event) => handleUniverseChange(event.target.value as UniverseKey)} className="w-full rounded-2xl border border-white/10 bg-surface-800 px-3 py-2 text-sm outline-none">
                {universeDefinitions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">Search</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-surface-800 px-3 py-2 text-sm outline-none" placeholder="Ticker or company" />
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">Sector</span>
              <select value={filters.sector} onChange={(event) => setFilters((current) => ({ ...current, sector: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-surface-800 px-3 py-2 text-sm outline-none">
                {sectorOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">Mkt Cap Min</span>
              <select value={filters.marketCapMinBn} onChange={(event) => setFilters((current) => ({ ...current, marketCapMinBn: Number(event.target.value) }))} className="w-full rounded-2xl border border-white/10 bg-surface-800 px-3 py-2 text-sm outline-none">
                {[10, 25, 50, 100, 250].map((value) => (
                  <option key={value} value={value}>
                    {value}B+
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">Avg $ Vol Min</span>
              <select value={filters.averageDollarVolumeMinM} onChange={(event) => setFilters((current) => ({ ...current, averageDollarVolumeMinM: Number(event.target.value) }))} className="w-full rounded-2xl border border-white/10 bg-surface-800 px-3 py-2 text-sm outline-none">
                {[50, 100, 250, 500, 1000].map((value) => (
                  <option key={value} value={value}>
                    {value}M+
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">ATR Max</span>
              <select value={filters.volatilityMaxPct} onChange={(event) => setFilters((current) => ({ ...current, volatilityMaxPct: Number(event.target.value) }))} className="w-full rounded-2xl border border-white/10 bg-surface-800 px-3 py-2 text-sm outline-none">
                {[4, 6, 8, 10, 12].map((value) => (
                  <option key={value} value={value}>
                    {value}%
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
              <input type="checkbox" checked={filters.excludeEarningsWindow} onChange={(event) => setFilters((current) => ({ ...current, excludeEarningsWindow: event.target.checked }))} />
              Exclude earnings within 7 days
            </label>
            <div className="md:col-span-2 xl:col-span-2">
              <div className="flex gap-2">
                <input value={customTickerInput} onChange={(event) => setCustomTickerInput(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-surface-800 px-3 py-2 text-sm outline-none" placeholder="Custom tickers, comma separated" />
                <button type="button" onClick={handleCustomUniverse} className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/20">
                  Apply
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.22em] text-slate-500">
                <tr>
                  <th className="pb-3 pr-4">Name</th>
                  <th className="pb-3 pr-4">Score</th>
                  <th className="pb-3 pr-4">Setup</th>
                  <th className="pb-3 pr-4">Why Watch</th>
                  <th className="pb-3 pr-4">Why Not Yet</th>
                  <th className="pb-3 pr-4">Key Level</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredCandidates.map((candidate) => (
                  <tr key={candidate.profile.ticker} className="align-top">
                    <td className="py-4 pr-4">
                      <Link href={`/stocks/${candidate.profile.ticker}`} className="block">
                        <div className="font-semibold text-slate-50">{candidate.profile.ticker}</div>
                        <div className="text-xs text-slate-400">{candidate.profile.companyName}</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {candidate.profile.themes.map((theme) => (
                            <Badge key={theme} tone="neutral">{theme}</Badge>
                          ))}
                        </div>
                      </Link>
                    </td>
                    <td className="py-4 pr-4">
                      <div className="space-y-2">
                        <ScoreBadge score={candidate.score.finalScore} />
                        <p className="text-xs text-slate-400">Mkt cap {candidate.fundamentals.marketCapBn >= 100 ? candidate.fundamentals.marketCapBn.toFixed(0) : candidate.fundamentals.marketCapBn.toFixed(1)}B</p>
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <Badge tone={candidate.label === "Avoid" ? "danger" : candidate.label === "Earnings watch" ? "caution" : "positive"}>{candidate.label}</Badge>
                    </td>
                    <td className="py-4 pr-4 text-slate-300">{candidate.narrative.whyWatch[0]}</td>
                    <td className="py-4 pr-4 text-slate-400">{candidate.narrative.whyNotYet[0]}</td>
                    <td className="py-4 pr-4">
                      <div className="text-slate-200">Trigger {formatCurrency(candidate.keyLevels.breakout)}</div>
                      <div className="text-xs text-slate-500">Invalidate {formatCurrency(candidate.keyLevels.invalidation)}</div>
                    </td>
                    <td className="py-4 text-right">
                      <button type="button" onClick={() => handleToggleWatchlist(candidate.profile.ticker)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-300/30 hover:bg-white/10">
                        {savedTickers.has(candidate.profile.ticker) ? "Saved" : "Save"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Risk Alerts" subtitle="High-impact items that can distort otherwise good-looking setups.">
            <div className="space-y-3">
              {data.riskAlerts.map((alert) => (
                <div key={alert.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-50">{alert.title}</p>
                      <p className="mt-1 text-sm text-slate-300">{alert.reason}</p>
                    </div>
                    <Badge tone={alert.severity === "high" ? "danger" : alert.severity === "medium" ? "caution" : "neutral"}>{alert.severity}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="My Watchlist" subtitle="Saved names plus today's snapshot changes."
            action={<a href="/api/export?scope=snapshot" className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/10">CSV export</a>}
          >
            <div className="space-y-3">
              {myWatchlistRows.map((row) => (
                <div key={row.saved.ticker} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{row.saved.ticker}</span>
                        {row.snapshot?.isNew ? <Badge tone="info">new candidate</Badge> : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-300">{row.candidate?.narrative.whyWatch[0] ?? row.snapshot?.reason ?? "Saved for monitoring."}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-200">{row.snapshot ? row.snapshot.score.toFixed(1) : "--"}</div>
                      {row.snapshot ? <div className={`text-xs ${watchlistDeltaTone(row.snapshot.deltaFromPrior)}`}>{row.snapshot.deltaFromPrior >= 0 ? "+" : ""}{row.snapshot.deltaFromPrior.toFixed(1)} vs yday</div> : null}
                    </div>
                  </div>
                </div>
              ))}
              {myWatchlistRows.length === 0 ? <p className="text-sm text-slate-400">No saved names yet. Save from the candidate table to build your own watchlist.</p> : null}
            </div>
            <div className="mt-5 grid gap-3">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-500">New candidates</p>
                <div className="flex flex-wrap gap-2">
                  {data.watchlist.items.filter((item) => item.isNew).map((item) => (
                    <span key={item.ticker} className="pill">{item.ticker}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-500">Removed since yesterday</p>
                <div className="flex flex-wrap gap-2">
                  {data.watchlist.removedTickers.length > 0 ? data.watchlist.removedTickers.map((ticker) => <span key={ticker} className="pill">{ticker}</span>) : <span className="text-sm text-slate-400">No removals.</span>}
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}
