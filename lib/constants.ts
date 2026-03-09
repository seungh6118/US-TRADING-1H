import { UniverseDefinition } from "@/lib/types";

export const universeDefinitions: UniverseDefinition[] = [
  {
    key: "sp500",
    label: "S&P500 리더",
    description: "기본 감시 유니버스로 쓰기 좋은 대형 리더 종목 묶음입니다.",
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
    label: "나스닥100 중심",
    description: "성장주 중심으로 모멘텀 리더를 확인하기 좋은 유니버스입니다.",
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
    label: "매그니피센트 7",
    description: "메가캡 리더를 빠르게 체크하기 위한 묶음입니다.",
    tickers: ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "TSLA"]
  },
  {
    key: "semiconductors",
    label: "반도체",
    description: "AI 가속기와 반도체 인프라 중심 유니버스입니다.",
    tickers: ["NVDA", "AMD", "AVGO", "SMCI"]
  },
  {
    key: "defense",
    label: "방산",
    description: "방산 및 안보 관련 종목 묶음입니다.",
    tickers: ["RTX", "LMT", "PLTR"]
  },
  {
    key: "custom",
    label: "사용자 지정",
    description: "직접 입력한 티커 리스트를 사용합니다.",
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