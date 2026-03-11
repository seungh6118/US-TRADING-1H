const REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0",
  Accept: "text/html,application/xhtml+xml"
};

export interface Sp500Constituent {
  symbol: string;
  companyName: string;
  sector: string;
  industry: string;
}

type CachedConstituents = {
  expiresAt: number;
  data: Sp500Constituent[];
};

let cachedConstituents: CachedConstituents | null = null;

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"');
}

function normalizeSymbol(symbol: string) {
  return symbol.replaceAll(".", "-").trim().toUpperCase();
}

export async function fetchSp500Constituents(): Promise<Sp500Constituent[]> {
  if (cachedConstituents && cachedConstituents.expiresAt > Date.now()) {
    return cachedConstituents.data;
  }

  const response = await fetch("https://en.wikipedia.org/wiki/List_of_S%26P_500_companies", {
    cache: "no-store",
    headers: REQUEST_HEADERS
  });

  if (!response.ok) {
    throw new Error(`Failed to load S&P 500 constituents: ${response.status}`);
  }

  const html = await response.text();
  const tableMatch = html.match(/<table[^>]*id="constituents"[\s\S]*?<\/table>/i);
  if (!tableMatch) {
    throw new Error("S&P 500 constituents table not found");
  }

  const rows = [...tableMatch[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].slice(1);
  const constituents = rows
    .map((row) => {
      const cells = [...row[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => decodeHtml(stripTags(cell[1])));
      if (cells.length < 8) {
        return null;
      }

      return {
        symbol: normalizeSymbol(cells[0]),
        companyName: cells[1],
        sector: cells[3],
        industry: cells[4]
      } satisfies Sp500Constituent;
    })
    .filter((item): item is Sp500Constituent => Boolean(item));

  cachedConstituents = {
    expiresAt: Date.now() + 1000 * 60 * 60 * 12,
    data: constituents
  };

  return constituents;
}
