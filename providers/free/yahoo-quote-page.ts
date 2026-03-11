type YahooQuotePageSnapshot = {
  ticker: string;
  companyName: string | null;
  marketCapBn: number | null;
  averageVolumeShares: number | null;
  beta: number | null;
  trailingPe: number | null;
  nextEarningsDate: string | null;
  sourceUrl: string;
};

const REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0"
};

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractMetricValue(html: string, label: string): string | null {
  const labelPattern = new RegExp(`title="${escapeRegExp(label)}"`, "i");
  const labelMatch = labelPattern.exec(html);
  if (!labelMatch) {
    return null;
  }

  const snippet = html.slice(labelMatch.index, labelMatch.index + 800);
  const valueMatch = snippet.match(/<span class="value[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  if (!valueMatch) {
    return null;
  }

  return stripTags(decodeHtml(valueMatch[1])) || null;
}

function parseCompactNumber(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const normalized = value.replaceAll(",", "").trim().toUpperCase();
  if (!normalized || normalized === "--" || normalized === "N/A") {
    return null;
  }

  const match = normalized.match(/^(-?\d+(?:\.\d+)?)([TMBK]?)$/);
  if (!match) {
    return null;
  }

  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const multiplier =
    match[2] === "T"
      ? 1_000_000_000_000
      : match[2] === "B"
        ? 1_000_000_000
        : match[2] === "M"
          ? 1_000_000
          : match[2] === "K"
            ? 1_000
            : 1;

  return numeric * multiplier;
}

function parseNumber(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const normalized = value.replaceAll(",", "").trim();
  if (!normalized || normalized === "--" || normalized === "N/A") {
    return null;
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseDateValue(value: string | null): string | null {
  if (!value || value === "--") {
    return null;
  }

  const match = value.match(/[A-Z][a-z]{2} \d{1,2}, \d{4}/);
  if (!match) {
    return null;
  }

  const parsed = new Date(match[0]);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function extractCompanyName(html: string, ticker: string): string | null {
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  if (!titleMatch) {
    return null;
  }

  const title = decodeHtml(stripTags(titleMatch[1]));
  const tickerPattern = new RegExp(`^(.*?)\\s*\\(${escapeRegExp(ticker.toUpperCase())}\\)`);
  const match = title.match(tickerPattern);
  if (!match) {
    return null;
  }

  return match[1].trim() || null;
}

export async function fetchYahooQuotePageSnapshot(ticker: string): Promise<YahooQuotePageSnapshot> {
  const normalizedTicker = ticker.toUpperCase();
  const sourceUrl = `https://finance.yahoo.com/quote/${encodeURIComponent(normalizedTicker)}/`;
  const response = await fetch(sourceUrl, {
    headers: REQUEST_HEADERS,
    next: { revalidate: 900 }
  });

  if (!response.ok) {
    throw new Error(`Yahoo quote page request failed for ${normalizedTicker}: ${response.status}`);
  }

  const html = await response.text();
  const marketCapRaw = extractMetricValue(html, "Market Cap (intraday)") ?? extractMetricValue(html, "Market Cap");
  const averageVolumeRaw = extractMetricValue(html, "Avg. Volume");
  const betaRaw = extractMetricValue(html, "Beta (5Y Monthly)");
  const trailingPeRaw = extractMetricValue(html, "PE Ratio (TTM)");
  const earningsDateRaw =
    extractMetricValue(html, "Earnings Date") ?? extractMetricValue(html, "Earnings Date (est.)");

  return {
    ticker: normalizedTicker,
    companyName: extractCompanyName(html, normalizedTicker),
    marketCapBn: ((parseCompactNumber(marketCapRaw) ?? 0) / 1_000_000_000) || null,
    averageVolumeShares: parseCompactNumber(averageVolumeRaw),
    beta: parseNumber(betaRaw),
    trailingPe: parseNumber(trailingPeRaw),
    nextEarningsDate: parseDateValue(earningsDateRaw),
    sourceUrl
  };
}
