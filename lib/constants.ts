import { UniverseDefinition } from "@/lib/types";

export const universeDefinitions: UniverseDefinition[] = [
  {
    key: "sp500",
    label: "S&P500 핵심",
    description: "미국 대형주 핵심 감시 유니버스입니다.",
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
    description: "메가캡 리더만 빠르게 체크하는 유니버스입니다.",
    tickers: ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "TSLA"]
  },
  {
    key: "semiconductors",
    label: "반도체",
    description: "AI와 데이터센터 핵심 반도체 종목을 집중 추적합니다.",
    tickers: ["NVDA", "AMD", "AVGO", "SMCI", "ANET"]
  },
  {
    key: "defense",
    label: "방산",
    description: "방산과 안보 관련 핵심 종목 유니버스입니다.",
    tickers: ["RTX", "LMT", "PLTR", "NOC"]
  },
  {
    key: "powerInfrastructure",
    label: "전력 인프라",
    description: "데이터센터 전력, 발전, 송배전, 원자력 관련 종목을 함께 추적합니다.",
    tickers: ["VRT", "ETN", "GEV", "CEG", "BE", "VST", "NRG", "TLN", "BWXT"]
  },
  {
    key: "custom",
    label: "사용자 지정",
    description: "직접 입력한 티커 목록으로 후보를 계산합니다.",
    tickers: []
  }
];

export const themeKeywords: Record<string, string[]> = {
  AI: ["AI", "artificial intelligence", "accelerator", "GPU", "inference", "model"],
  Semiconductor: ["semiconductor", "chip", "fabless", "GPU", "ASIC"],
  Cloud: ["cloud", "hyperscaler", "software infrastructure", "data center"],
  "Power Infrastructure": ["power", "grid", "electrification", "transformer", "fuel cell", "generation"],
  Nuclear: ["nuclear", "uranium", "reactor", "small modular reactor"],
  Defense: ["defense", "missile", "aerospace", "military"],
  Cybersecurity: ["security", "cyber", "identity", "endpoint", "network security"],
  Robotics: ["robotics", "automation", "industrial software", "autonomy"],
  "Obesity Treatment": ["obesity", "GLP-1", "weight loss", "diabetes"]
};
