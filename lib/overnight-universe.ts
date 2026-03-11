export const overnightScreeners = [
  "day_gainers",
  "most_actives",
  "growth_technology_stocks"
] as const;

export const overnightFocusSymbols = [
  "NVDA",
  "AVGO",
  "AMD",
  "MU",
  "VRT",
  "GEV",
  "BE",
  "ANET",
  "ORCL",
  "APP",
  "HIMS",
  "HOOD",
  "COIN",
  "ARM",
  "TSM",
  "PANW",
  "CRWD",
  "CEG",
  "ETN",
  "SNDK"
] as const;

export const marketIndexSymbols = {
  qqq: "QQQ",
  spy: "SPY",
  dia: "DIA",
  iwm: "IWM",
  vix: "^VIX"
} as const;

export const sectorEtfByKey: Record<string, string> = {
  Technology: "XLK",
  Semiconductors: "SOXX",
  "Electronic Components": "SOXX",
  "Software - Infrastructure": "IGV",
  "Software - Application": "IGV",
  "Communication Services": "XLC",
  "Internet Content & Information": "XLC",
  "Consumer Cyclical": "XLY",
  "Consumer Defensive": "XLP",
  Industrials: "XLI",
  Utilities: "XLU",
  Energy: "XLE",
  Healthcare: "XLV",
  "Financial Services": "XLF",
  "Banks - Regional": "KBE",
  "Banks - Diversified": "XLF",
  "Capital Markets": "XLF",
  RealEstate: "XLRE",
  Materials: "XLB"
};

export function inferSectorEtf(sector: string, industry: string): string {
  if (sectorEtfByKey[industry]) {
    return sectorEtfByKey[industry];
  }
  if (sectorEtfByKey[sector]) {
    return sectorEtfByKey[sector];
  }

  const lower = `${sector} ${industry}`.toLowerCase();
  if (lower.includes("semiconductor") || lower.includes("chip")) {
    return "SOXX";
  }
  if (lower.includes("software") || lower.includes("cyber")) {
    return "IGV";
  }
  if (lower.includes("utility") || lower.includes("power") || lower.includes("grid") || lower.includes("electric")) {
    return "XLU";
  }
  if (lower.includes("energy")) {
    return "XLE";
  }
  if (lower.includes("health")) {
    return "XLV";
  }
  if (lower.includes("bank") || lower.includes("financial")) {
    return "XLF";
  }
  if (lower.includes("industrial")) {
    return "XLI";
  }
  if (lower.includes("retail") || lower.includes("consumer")) {
    return "XLY";
  }

  return "SPY";
}
