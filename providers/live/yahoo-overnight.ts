import { fetchYahooQuotePageSnapshot } from "@/providers/free/yahoo-quote-page";
import { overnightRuntime } from "@/lib/overnight-runtime";

const REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0",
  Accept: "application/json,text/plain,*/*"
};

type CacheEntry = {
  expiresAt: number;
  data: unknown;
};

const responseCache = new Map<string, CacheEntry>();

type YahooRawValue = {
  raw?: number | string | boolean | null;
  fmt?: string;
  longFmt?: string;
} | number | string | boolean | null | undefined;

type YahooScreenerResponse = {
  finance?: {
    result?: Array<{
      quotes?: Array<Record<string, YahooRawValue>>;
    }>;
    error?: { code?: string; description?: string } | null;
  };
};

type YahooSearchResponse = {
  quotes?: Array<{
    symbol?: string;
    shortname?: string;
    longname?: string;
    sector?: string;
    sectorDisp?: string;
    industry?: string;
    industryDisp?: string;
  }>;
  news?: Array<{
    uuid?: string;
    title?: string;
    publisher?: string;
    link?: string;
    providerPublishTime?: number;
    relatedTickers?: string[];
  }>;
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        longName?: string;
        shortName?: string;
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        regularMarketVolume?: number;
        marketState?: string;
        currentTradingPeriod?: {
          pre?: { start?: number; end?: number };
          regular?: { start?: number; end?: number };
          post?: { start?: number; end?: number };
        };
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: { code?: string; description?: string } | null;
  };
};

type YahooSparkResponse = {
  spark?: {
    result?: Array<{
      symbol?: string;
      response?: Array<{
        meta?: {
          symbol?: string;
          longName?: string;
          shortName?: string;
          regularMarketPrice?: number;
          previousClose?: number;
          chartPreviousClose?: number;
          regularMarketDayHigh?: number;
          regularMarketDayLow?: number;
          regularMarketVolume?: number;
          marketState?: string;
          currentTradingPeriod?: {
            regular?: { start?: number; end?: number };
            post?: { start?: number; end?: number };
          };
        };
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            close?: Array<number | null>;
          }>;
        };
      }>;
    }>;
    error?: { code?: string; description?: string } | null;
  };
};

export interface YahooScreenedQuote {
  symbol: string;
  companyName: string;
  price: number;
  dayChangePct: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  averageVolume: number;
  marketCapBn: number;
  bid: number | null;
  ask: number | null;
  postMarketPrice: number | null;
  postMarketChangePct: number;
  earningsDate: string | null;
  analystRating: string | null;
  trailingPe: number | null;
  marketState: string;
  screeners: string[];
}

export interface YahooSearchBundle {
  sector: string;
  industry: string;
  companyName: string | null;
  news: Array<{
    id: string;
    title: string;
    source: string;
    publishedAt: string;
    url: string;
    relatedTickers: string[];
  }>;
}

export interface YahooBar {
  time: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface YahooChartData {
  symbol: string;
  companyName: string | null;
  price: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  regularVolume: number;
  marketState: string;
  regularStart: number | null;
  regularEnd: number | null;
  preStart: number | null;
  preEnd: number | null;
  postStart: number | null;
  postEnd: number | null;
  bars: YahooBar[];
}

export interface YahooSparkQuote {
  symbol: string;
  companyName: string | null;
  price: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  regularVolume: number;
  marketState: string;
  regularStart: number | null;
  regularEnd: number | null;
  postStart: number | null;
  postEnd: number | null;
  timestamps: number[];
  closes: number[];
}

function getRawValue(value: YahooRawValue) {
  if (value && typeof value === "object" && "raw" in value) {
    return value.raw;
  }
  return value;
}

function getNumber(value: YahooRawValue, fallback = 0): number {
  const raw = getRawValue(value);
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    const parsed = Number(raw.replaceAll(",", ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function getNullableNumber(value: YahooRawValue): number | null {
  const raw = getRawValue(value);
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    const parsed = Number(raw.replaceAll(",", ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getString(value: YahooRawValue): string | null {
  const raw = getRawValue(value);
  return typeof raw === "string" && raw.trim().length > 0 ? raw : null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const now = Date.now();
  const cached = responseCache.get(url);
  if (cached && cached.expiresAt > now) {
    return cached.data as T;
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers: REQUEST_HEADERS
  });

  if (!response.ok) {
    throw new Error(`Yahoo request failed (${response.status}) for ${url}`);
  }

  const data = (await response.json()) as T;
  responseCache.set(url, {
    expiresAt: now + overnightRuntime.cacheTtlMs,
    data
  });
  return data;
}

export async function fetchYahooScreenerQuotes(screenId: string, count: number): Promise<YahooScreenedQuote[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=true&scrIds=${encodeURIComponent(
    screenId
  )}&count=${count}`;
  const json = await fetchJson<YahooScreenerResponse>(url);
  const quotes = json.finance?.result?.[0]?.quotes ?? [];

  return quotes
    .map((quote) => {
      const symbol = getString(quote.symbol);
      const price = getNumber(quote.regularMarketPrice);
      if (!symbol || price <= 0) {
        return null;
      }

      const earningsValue =
        getString(quote.earningsTimestamp) ??
        getString(quote.earningsTimestampStart) ??
        getString(quote.earningsTimestampEnd);
      const earningsEpoch =
        getNullableNumber(quote.earningsTimestamp) ??
        getNullableNumber(quote.earningsTimestampStart) ??
        getNullableNumber(quote.earningsTimestampEnd);

      return {
        symbol,
        companyName:
          getString(quote.longName) ??
          getString(quote.displayName) ??
          getString(quote.shortName) ??
          getString(quote.companyshortname) ??
          symbol,
        price,
        dayChangePct: getNumber(quote.regularMarketChangePercent),
        dayHigh: getNumber(quote.regularMarketDayHigh, price),
        dayLow: getNumber(quote.regularMarketDayLow, price),
        volume: getNumber(quote.regularMarketVolume),
        averageVolume: getNumber(quote.averageDailyVolume3Month) || getNumber(quote.averageDailyVolume10Day),
        marketCapBn: getNumber(quote.marketCap) / 1_000_000_000,
        bid: getNullableNumber(quote.bid),
        ask: getNullableNumber(quote.ask),
        postMarketPrice: getNullableNumber(quote.postMarketPrice),
        postMarketChangePct: getNumber(quote.postMarketChangePercent),
        earningsDate:
          earningsEpoch !== null
            ? new Date(earningsEpoch * 1000).toISOString()
            : earningsValue && /^\d{4}-\d{2}-\d{2}/.test(earningsValue)
              ? new Date(earningsValue).toISOString()
              : null,
        analystRating: getString(quote.averageAnalystRating),
        trailingPe: getNullableNumber(quote.trailingPE),
        marketState: getString(quote.marketState) ?? "REGULAR",
        screeners: [screenId]
      } satisfies YahooScreenedQuote;
    })
    .filter((item): item is YahooScreenedQuote => Boolean(item));
}

export async function fetchYahooSearchBundle(symbol: string, newsCount = 6): Promise<YahooSearchBundle> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=1&newsCount=${newsCount}`;
  const json = await fetchJson<YahooSearchResponse>(url);
  const quote = json.quotes?.find((item) => (item.symbol ?? "").toUpperCase() === symbol.toUpperCase()) ?? json.quotes?.[0];

  return {
    sector: quote?.sectorDisp ?? quote?.sector ?? "기타",
    industry: quote?.industryDisp ?? quote?.industry ?? "기타",
    companyName: quote?.longname ?? quote?.shortname ?? null,
    news:
      json.news?.map((item) => ({
        id: item.uuid ?? `${symbol}-${item.providerPublishTime ?? Date.now()}`,
        title: item.title ?? `${symbol} 뉴스`,
        source: item.publisher ?? "Yahoo Finance",
        publishedAt: new Date((item.providerPublishTime ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        url: item.link ?? `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/`,
        relatedTickers: item.relatedTickers ?? [symbol]
      })) ?? []
  };
}

export async function fetchYahooChartData(
  symbol: string,
  range: string,
  interval: string,
  includePrePost: boolean
): Promise<YahooChartData> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=${range}&interval=${interval}&includePrePost=${includePrePost ? "true" : "false"}&events=div%2Csplits`;
  const json = await fetchJson<YahooChartResponse>(url);
  const result = json.chart?.result?.[0];
  if (!result?.meta || !result.indicators?.quote?.[0]) {
    throw new Error(`Yahoo chart payload is empty for ${symbol}`);
  }

  const quote = result.indicators.quote[0];
  const timestamps = result.timestamp ?? [];
  const opens = quote.open ?? [];
  const highs = quote.high ?? [];
  const lows = quote.low ?? [];
  const closes = quote.close ?? [];
  const volumes = quote.volume ?? [];

  const bars = timestamps
    .map((time, index) => {
      const open = opens[index];
      const high = highs[index];
      const low = lows[index];
      const close = closes[index];
      const volume = volumes[index];
      if (
        open === null ||
        high === null ||
        low === null ||
        close === null ||
        open === undefined ||
        high === undefined ||
        low === undefined ||
        close === undefined
      ) {
        return null;
      }

      return {
        time,
        date: new Date(time * 1000).toISOString(),
        open,
        high,
        low,
        close,
        volume: Math.max(0, volume ?? 0)
      } satisfies YahooBar;
    })
    .filter((item): item is YahooBar => Boolean(item));

  return {
    symbol: result.meta.symbol ?? symbol,
    companyName: result.meta.longName ?? result.meta.shortName ?? null,
    price: result.meta.regularMarketPrice ?? bars.at(-1)?.close ?? 0,
    previousClose: result.meta.previousClose ?? result.meta.chartPreviousClose ?? bars.at(-2)?.close ?? 0,
    dayHigh: result.meta.regularMarketDayHigh ?? bars.reduce((max, bar) => Math.max(max, bar.high), 0),
    dayLow: result.meta.regularMarketDayLow ?? bars.reduce((min, bar) => Math.min(min || bar.low, bar.low), 0),
    regularVolume: result.meta.regularMarketVolume ?? 0,
    marketState: result.meta.marketState ?? "REGULAR",
    regularStart: result.meta.currentTradingPeriod?.regular?.start ?? null,
    regularEnd: result.meta.currentTradingPeriod?.regular?.end ?? null,
    preStart: result.meta.currentTradingPeriod?.pre?.start ?? null,
    preEnd: result.meta.currentTradingPeriod?.pre?.end ?? null,
    postStart: result.meta.currentTradingPeriod?.post?.start ?? null,
    postEnd: result.meta.currentTradingPeriod?.post?.end ?? null,
    bars
  };
}

export async function fetchYahooSparkBatch(
  symbols: string[],
  range: string,
  interval: string,
  includePrePost: boolean
): Promise<YahooSparkQuote[]> {
  if (symbols.length === 0) {
    return [];
  }

  if (symbols.length > 20) {
    const chunks: string[][] = [];
    for (let index = 0; index < symbols.length; index += 20) {
      chunks.push(symbols.slice(index, index + 20));
    }

    const chunkResults = await Promise.all(chunks.map((chunk) => fetchYahooSparkBatch(chunk, range, interval, includePrePost)));
    return chunkResults.flat();
  }

  const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(
    symbols.join(",")
  )}&range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&includePrePost=${
    includePrePost ? "true" : "false"
  }`;
  let json: YahooSparkResponse;
  try {
    json = await fetchJson<YahooSparkResponse>(url);
  } catch (error) {
    if (symbols.length === 1) {
      throw error;
    }

    const midpoint = Math.ceil(symbols.length / 2);
    const left = await fetchYahooSparkBatch(symbols.slice(0, midpoint), range, interval, includePrePost);
    const right = await fetchYahooSparkBatch(symbols.slice(midpoint), range, interval, includePrePost);
    return [...left, ...right];
  }
  const results = json.spark?.result ?? [];

  return results
    .map((item) => {
      const response = item.response?.[0];
      const meta = response?.meta;
      const closes = (response?.indicators?.quote?.[0]?.close ?? []).filter(
        (value): value is number => typeof value === "number" && Number.isFinite(value)
      );
      const timestamps = response?.timestamp ?? [];

      if (!meta?.symbol || closes.length === 0) {
        return null;
      }

      return {
        symbol: meta.symbol,
        companyName: meta.longName ?? meta.shortName ?? null,
        price: meta.regularMarketPrice ?? closes.at(-1) ?? 0,
        previousClose: meta.previousClose ?? meta.chartPreviousClose ?? closes.at(-2) ?? 0,
        dayHigh: meta.regularMarketDayHigh ?? Math.max(...closes),
        dayLow: meta.regularMarketDayLow ?? Math.min(...closes),
        regularVolume: meta.regularMarketVolume ?? 0,
        marketState: meta.marketState ?? "REGULAR",
        regularStart: meta.currentTradingPeriod?.regular?.start ?? null,
        regularEnd: meta.currentTradingPeriod?.regular?.end ?? null,
        postStart: meta.currentTradingPeriod?.post?.start ?? null,
        postEnd: meta.currentTradingPeriod?.post?.end ?? null,
        timestamps,
        closes
      } satisfies YahooSparkQuote;
    })
    .filter((item): item is YahooSparkQuote => Boolean(item));
}

export async function fetchYahooFocusSymbolQuote(symbol: string): Promise<YahooScreenedQuote> {
  const [intraday, quotePage] = await Promise.all([
    fetchYahooChartData(symbol, "1d", "1m", true),
    fetchYahooQuotePageSnapshot(symbol)
  ]);

  const postBars =
    intraday.postStart && intraday.postEnd
      ? intraday.bars.filter((bar) => bar.time >= intraday.postStart! && bar.time <= intraday.postEnd!)
      : [];
  const postLast = postBars.at(-1);

  return {
    symbol,
    companyName: quotePage.companyName ?? intraday.companyName ?? symbol,
    price: intraday.price,
    dayChangePct: intraday.previousClose > 0 ? ((intraday.price - intraday.previousClose) / intraday.previousClose) * 100 : 0,
    dayHigh: intraday.dayHigh,
    dayLow: intraday.dayLow,
    volume: intraday.regularVolume,
    averageVolume: quotePage.averageVolumeShares ?? 0,
    marketCapBn: quotePage.marketCapBn ?? 0,
    bid: null,
    ask: null,
    postMarketPrice: postLast?.close ?? null,
    postMarketChangePct: postLast ? ((postLast.close - intraday.price) / intraday.price) * 100 : 0,
    earningsDate: quotePage.nextEarningsDate,
    analystRating: null,
    trailingPe: quotePage.trailingPe,
    marketState: intraday.marketState,
    screeners: ["focus"]
  } as YahooScreenedQuote;
}
