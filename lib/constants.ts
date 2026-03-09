import { UniverseDefinition } from "@/lib/types";

export const universeDefinitions: UniverseDefinition[] = [
  {
    key: "sp500",
    label: "S&P500 Leaders",
    description: "Broad quality leadership basket used as the default research universe.",
    tickers: [
      "NVDA",
      "MSFT",
      "AMZN",
      "META",
      "GOOGL",
      "AAPL",
      "AVGO",
      "AMD",
      "SMCI",
      "PANW",
      "CRWD",
      "PLTR",
      "VRT",
      "ETN",
      "GEV",
      "CEG",
      "RTX",
      "LMT",
      "LLY",
      "TSLA"
    ]
  },
  {
    key: "nasdaq100",
    label: "Nasdaq100 Growth",
    description: "Growth-heavy basket to isolate momentum leadership.",
    tickers: [
      "NVDA",
      "MSFT",
      "AMZN",
      "META",
      "GOOGL",
      "AAPL",
      "AVGO",
      "AMD",
      "SMCI",
      "PANW",
      "CRWD",
      "TSLA",
      "LLY"
    ]
  },
  {
    key: "magnificent7",
    label: "Magnificent 7",
    description: "Mega-cap leadership proxy.",
    tickers: ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "TSLA"]
  },
  {
    key: "semiconductors",
    label: "Semiconductors",
    description: "AI compute and semiconductor infrastructure focus.",
    tickers: ["NVDA", "AMD", "AVGO", "SMCI"]
  },
  {
    key: "defense",
    label: "Defense",
    description: "Defense and security equities.",
    tickers: ["RTX", "LMT", "PLTR"]
  },
  {
    key: "custom",
    label: "Custom",
    description: "User-defined tickers from the UI or environment variables.",
    tickers: []
  }
];

export const themeKeywords: Record<string, string[]> = {
  AI: ["AI", "artificial intelligence", "accelerator", "GPU", "inference"],
  Semiconductor: ["semiconductor", "chip", "fabless", "GPU"],
  Cloud: ["cloud", "hyperscaler", "software infrastructure"],
  "Power Infrastructure": ["power", "grid", "electrification", "transformer"],
  Nuclear: ["nuclear", "uranium", "reactor"],
  Defense: ["defense", "missile", "aerospace"],
  Cybersecurity: ["security", "cyber", "identity"],
  Robotics: ["robotics", "automation", "industrial software"],
  "Obesity Treatment": ["obesity", "GLP-1", "weight loss"]
};
