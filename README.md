# US Stock AI Research Radar

Explainable US equity swing and position research app for a Korea-based workflow.

This app is not a news dump and not a chart-only viewer. It is designed to compress the US market into a smaller set of names worth monitoring today and this week, with deterministic scoring, clear explanations, and daily watchlist snapshots.

## 1. Architecture

- Frontend: Next.js App Router, TypeScript, Tailwind CSS, Recharts
- Backend: Next.js server components plus API routes under `app/api`
- Database: SQLite via `better-sqlite3`
- Data modes:
  - `mock`: fully seeded market, sector, theme, candidate, and watchlist data
  - `live`: Financial Modeling Prep based live stock-level provider with hybrid fallback for scaffolding still marked TODO
- AI usage:
  - Deterministic scoring only for rank and labels
  - AI only for market summary, theme summary, and stock explanation
- Storage model:
  - `saved_watchlist` table for user-saved names
  - `watchlist_snapshots` table for daily generated top-10 snapshot and yesterday-vs-today deltas

Request flow:

1. Provider factory resolves mock or live bundle.
2. Research service loads market, sector, theme, stock, and news data.
3. Scoring engine ranks each stock deterministically.
4. Watchlist service stores and compares daily snapshots in SQLite.
5. Dashboard and stock detail pages render explainable outputs.

## 2. Folder Structure

```text
app/
  api/
    dashboard/
    export/
    health/
    stocks/[ticker]/
    watchlist/
  stocks/[ticker]/
components/
lib/
services/
providers/
  live/
  mock/
scoring/
db/
api/
render.yaml
```

What lives where:

- `app`: pages, layout, globals, API routes
- `components`: dashboard UI, stock detail UI, charting, shared panels/badges
- `lib`: app config, constants, shared types, utilities
- `services`: orchestration layer for dashboard, detail, and watchlist workflows
- `providers`: mock and live data provider implementations behind interfaces
- `scoring`: deterministic ranking engine and risk-alert generation
- `db`: SQLite client and watchlist repositories
- `api`: response contracts for frontend fetches
- `render.yaml`: cloud deployment blueprint with persistent disk mount

## 3. Core Types

Key contracts live in `lib/types.ts`.

Important types:

- `MarketMacroSnapshot`: regime, indices, macro assets, economic events, AI summary
- `SectorPerformance`: 5/20/60 day relative strength and sector score
- `ThemeSnapshot`: mentions, sentiment, price momentum, linked tickers
- `StockSnapshot`: raw profile, quote, fundamentals, technicals, earnings, news, events, price history
- `CandidateStock`: scored stock with label, narrative, and key levels
- `ScoreBreakdown`: deterministic component scores plus risk penalty and final score
- `WatchlistSummary`: today's snapshot, saved names, removed names, score deltas
- `ProviderSet`: pluggable market/news/fundamentals/calendar/AI interfaces

## 4. Scoring Engine

Scoring is deterministic and lives in `scoring/engine.ts`.

Formula:

```ts
finalScore =
  0.15 * macroFit +
  0.20 * sectorStrength +
  0.15 * themeStrength +
  0.15 * earningsNews +
  0.20 * priceStructure +
  0.10 * flowVolume +
  0.05 * valuationSanity -
  riskPenalty;
```

Weights are centralized in `lib/config.ts`.

Implemented score components:

- `macroFit`: regime plus VIX, dollar, and sector beta fit
- `sectorStrength`: sector relative strength and 5/20/60 day performance
- `themeStrength`: theme scores tied to each stock's mapped themes
- `earningsNews`: revenue growth, EPS surprise, guidance, revisions, news sentiment
- `priceStructure`: MA alignment, 52-week high proximity, pullback quality, breakout support
- `flowVolume`: abnormal volume plus short-term acceleration
- `valuationSanity`: basic sanity check by sector profile
- `riskPenalty`: earnings proximity, ATR, extension, negative news, guidance cuts

Labels produced by rules:

- `Breakout candidate`
- `Pullback candidate`
- `Earnings watch`
- `Watch`
- `Avoid`

Every scored stock carries:

- why watching
- why not yet
- what confirms it
- what invalidates it

## 5. Mock Data Providers

Mock mode is production-shaped and immediately runnable.

Included:

- market regime summary
- indices and macro assets
- sector and theme leaderboards
- 20 seeded stocks across semiconductors, mega-cap platforms, cybersecurity, power infrastructure, defense, healthcare, and consumer discretionary
- synthetic but stable price histories for charting and MA calculation
- news summaries, earnings cadence, and event calendar
- seeded saved watchlist and daily snapshot history

Main mock files:

- `providers/mock/mock-data.ts`
- `providers/mock/mock-providers.ts`

## 6. Frontend Pages / Components

Primary routes:

- `/`: dashboard with the five required sections
- `/stocks/[ticker]`: stock detail page with chart, metrics, narrative, news, events, and peer names

Main components:

- `components/dashboard-client.tsx`
- `components/stock-detail-view.tsx`
- `components/price-chart.tsx`
- `components/ui.tsx`

Dashboard sections included on the first screen:

- Market Regime Summary
- Strong Sectors / Themes
- Top Stock Candidates
- Risk Alerts
- My Watchlist

Additional dashboard outputs:

- Today's Top 3 actionable names
- Top 5 watchlist names
- Avoid list 3
- CSV export
- saved-vs-removed watchlist distinction
- mobile responsive layout

## 7. README / Runbook

### Local run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Production check

```bash
npm run build
npm run start
```

### Health endpoint

```text
GET /api/health
```

Returns deployment-safe liveness information and whether persistent storage is configured.

### Verified in this workspace

- `tsc --noEmit`: passed
- `npm run build`: passed
- local runtime check: HTTP 200
- API check on `/api/dashboard` and `/api/stocks/NVDA`: HTTP 200

## 8. Env Example

Use `.env.example` as the starting point.

Main variables:

```env
APP_DATA_MODE=mock
APP_DEFAULT_UNIVERSE=sp500
APP_TIMEZONE=Asia/Seoul
APP_DB_PATH=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
FMP_API_KEY=
FMP_BASE_URL=https://financialmodelingprep.com/api/v3
APP_CUSTOM_TICKERS=
```

Mode behavior:

- `mock`: fully local seeded data
- `live`: tries Financial Modeling Prep for live stock/news/profile data
- missing `FMP_API_KEY` in live mode falls back to mock mode automatically
- `APP_DB_PATH`: if set, SQLite will be stored in that absolute path, which is required for persistent cloud disks

## 9. TODO For Live API Integration

Current live mode is intentionally hybrid. It already supports live stock-level fetches, but these are the next recommended upgrades:

- Replace proxy macro series with exact providers for VIX, UST 2Y, UST 10Y, DXY, WTI, and Gold
- Add sector ETF and theme-basket performance providers instead of current hybrid fallback
- Add real earnings calendar, insider activity, dilution, and regulatory risk feeds
- Add EPS revision and estimate-change provider
- Add provider-specific caching and rate-limit handling
- Add per-vendor retry and health monitoring
- Add true user custom universe persistence instead of env-only seed
- Add Postgres repository implementing the same watchlist repository contract
- Add scheduled daily snapshot generation if later desired

## Render Deployment

This repo is now prepared for Render Free using `render.yaml` with the native Node runtime.

Recommended flow:\n\n1. Push this project to a GitHub repository.\n2. In Render, create a new Blueprint service from that repo.\n3. Render will read `render.yaml` and create one free Node web service.\n4. After first deploy succeeds, open the service environment settings and add:\n   - `FMP_API_KEY`\n   - `OPENAI_API_KEY`\n5. Change `APP_DATA_MODE` from `mock` to `live` when you are ready for real data.

Important note:\n\n- Render Free web services spin down after 15 minutes of no traffic. The next request can take up to about a minute to wake the app up.\n- Free web services have an ephemeral filesystem, so saved watchlist data and local SQLite changes can reset after redeploys, restarts, or spin-down.\n- The core dashboard still works fine in free mode, but persistent user data is not guaranteed.\n- If you later need durable saved data, move the repository layer to Postgres or a hosted database.

## Docker

A `Dockerfile` is included.

Build and run:

```bash
docker build -t us-stock-ai-research .
docker run --rm -p 3000:3000 --env-file .env us-stock-ai-research
```

If you want the SQLite database outside the container image, pass `APP_DB_PATH` to a mounted path.

## Notes

- One high severity npm audit issue remains from installed dependencies. The app still builds and runs, but dependency review is recommended before deployment.
- The current watchlist generator is intentionally for candidate compression, not trade automation.