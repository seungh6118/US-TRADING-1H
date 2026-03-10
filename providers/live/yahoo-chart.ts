import type { PricePoint } from "@/lib/types";

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: { code?: string; description?: string } | null;
  };
};

export async function fetchYahooHistory(symbol: string, range = "1y", interval = "1d"): Promise<PricePoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false&events=div%2Csplits`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Yahoo chart request failed for ${symbol}: ${response.status}`);
  }

  const json = (await response.json()) as YahooChartResponse;
  const result = json.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  const closes = quote?.close ?? [];
  const volumes = quote?.volume ?? [];

  return timestamps
    .map((timestamp, index) => {
      const close = closes[index];
      if (close === null || close === undefined || !Number.isFinite(close)) {
        return null;
      }

      return {
        date: new Date(timestamp * 1000).toISOString(),
        close,
        volume: Math.max(0, volumes[index] ?? 0)
      } satisfies PricePoint;
    })
    .filter((point): point is PricePoint => Boolean(point));
}
