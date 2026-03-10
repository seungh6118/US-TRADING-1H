import { UniverseDefinition } from "@/lib/types";

export const universeDefinitions: UniverseDefinition[] = [
  {
    key: "sp500",
    label: "S&P500 핵심",
    description: "가장 기본으로 보기 좋은 미국 대형주 감시 유니버스입니다.",
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
    label: "나스닥100 핵심",
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
    description: "메가캡 리더만 빠르게 체크하고 싶을 때 쓰는 묶음입니다.",
    tickers: ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "TSLA"]
  },
  {
    key: "semiconductors",
    label: "반도체",
    description: "AI와 데이터센터 관련 반도체 핵심 종목만 모아봅니다.",
    tickers: ["NVDA", "AMD", "AVGO", "SMCI"]
  },
  {
    key: "defense",
    label: "방산",
    description: "방산과 안보 관련 핵심 종목만 압축해 보는 유니버스입니다.",
    tickers: ["RTX", "LMT", "PLTR"]
  },
  {
    key: "custom",
    label: "사용자 지정",
    description: "직접 입력한 티커 목록으로 후보를 계산합니다.",
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
