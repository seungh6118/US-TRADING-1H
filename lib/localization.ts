import {
  AlertSeverity,
  CandidateLabel,
  ImpactLevel,
  MarketRegime,
  ProviderRuntime,
  UniverseKey
} from "@/lib/types";

const regimeMap: Record<MarketRegime, string> = {
  "risk-on": "리스크 온",
  neutral: "중립",
  "risk-off": "리스크 오프"
};

const runtimeMap: Record<ProviderRuntime, string> = {
  mock: "모의",
  live: "실시간",
  hybrid: "혼합"
};

const candidateLabelMap: Record<CandidateLabel, string> = {
  "Breakout candidate": "돌파 후보",
  "Pullback candidate": "눌림목 후보",
  "Earnings watch": "실적 체크",
  Watch: "관심",
  Avoid: "회피"
};

const severityMap: Record<AlertSeverity, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음"
};

const impactMap: Record<ImpactLevel, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음"
};

const universeMap: Record<UniverseKey, string> = {
  sp500: "S&P500 핵심",
  nasdaq100: "나스닥100 핵심",
  magnificent7: "매그니피센트 7",
  semiconductors: "반도체",
  defense: "방산",
  custom: "사용자 지정"
};

const sectorMap: Record<string, string> = {
  Semiconductors: "반도체",
  "Power Infrastructure": "전력 인프라",
  "Utilities & Nuclear": "유틸리티 / 원자력",
  Cybersecurity: "사이버보안",
  "Mega-Cap Platforms": "메가캡 플랫폼",
  Defense: "방산",
  Healthcare: "헬스케어",
  "Consumer Discretionary": "경기소비재",
  "Cross-Market": "시장 전체",
  Macro: "매크로"
};

const themeMap: Record<string, string> = {
  AI: "AI",
  Semiconductor: "반도체",
  Cloud: "클라우드",
  "Power Infrastructure": "전력 인프라",
  Nuclear: "원자력",
  Defense: "방산",
  Cybersecurity: "사이버보안",
  Robotics: "로봇",
  "Obesity Treatment": "비만 치료제"
};

const stockDescriptionMap: Record<string, string> = {
  NVDA: "AI 가속기 대표주이지만 최근에는 추세 둔화와 변동성 확대가 함께 나타나 확인이 더 필요한 구간입니다.",
  AVGO: "커스텀 AI ASIC과 네트워킹 수요가 꾸준해 반도체 대형주 안에서 상대적으로 구조가 좋은 편입니다.",
  AMD: "서버 비중 개선과 AI 노출 확대로 재평가 여지가 남아 있는 2선 AI 반도체 종목입니다.",
  SMCI: "AI 서버 인프라 수혜주지만 이벤트와 회계 이슈에 따라 변동성이 큰 종목입니다.",
  MSFT: "AI 수익화와 클라우드 방어력이 동시에 유지되는 메가캡 플랫폼입니다.",
  AMZN: "AWS 회복과 리테일 마진 개선이 겹치며 추세 점검 가치가 높은 대형 성장주입니다.",
  META: "광고 회복과 참여 지표가 강하지만 단기 과열 여부를 함께 봐야 하는 메가캡입니다.",
  GOOGL: "클라우드 개선과 AI 제품 사이클이 이어지지만 검색 우려도 병행 점검이 필요합니다.",
  AAPL: "서비스 기반은 안정적이지만 상대강도 측면에서는 아직 확실한 리더라고 보기 어렵습니다.",
  PANW: "플랫폼 통합 스토리와 빌링스 개선 기대가 맞물리는 사이버보안 대형주입니다.",
  CRWD: "기관 수급과 성장률이 모두 강한 대표 사이버보안 리더입니다.",
  PLTR: "정부와 상업 부문 AI 수요가 이어지지만 밸류에이션 부담과 과열 리스크가 공존합니다.",
  VRT: "AI 데이터센터 전력 체인 수혜주로 눌림 구간 재관찰 가치가 높은 종목입니다.",
  ETN: "전력망 투자와 설비 증설 수요가 동시에 이어지는 산업 리더입니다.",
  GEV: "전력 장비 교체와 그리드 투자 확대 수혜가 기대되는 중기 추세 종목입니다.",
  CEG: "전력 부족과 원자력 기저 수요 증가의 수혜를 받는 발전 관련 대표주입니다.",
  RTX: "방산 백로그는 탄탄하지만 추세 탄력은 성장 리더들보다 다소 완만합니다.",
  LMT: "방어적 성격은 있지만 최근 가격 모멘텀은 아직 제한적인 전통 방산주입니다.",
  LLY: "GLP-1 리더십은 유효하지만 최근 가격은 숨 고르기 구간으로 보는 편이 낫습니다.",
  TSLA: "헤드라인 변동성이 크고 상대강도도 약해 보수적으로 접근해야 하는 종목입니다."
};

const stockEventNoteMap: Record<string, string> = {
  NVDA: "다음 체크포인트는 대형 고객의 AI 투자 코멘트와 주가가 20일선 위를 다시 회복하는지 여부입니다.",
  AVGO: "커스텀 AI ASIC 출하와 네트워킹 수요가 계속 확인되는지가 핵심입니다.",
  AMD: "MI 시리즈 수요와 데이터센터 믹스 개선이 다시 확인되면 점수 회복이 가능합니다.",
  SMCI: "재고와 마진 코멘트가 주가 반응을 크게 좌우할 수 있습니다.",
  MSFT: "Azure 성장률과 Copilot 부가 매출 흐름이 다음 핵심 체크포인트입니다.",
  AMZN: "AWS 내 AI 서비스 수요가 실적과 가이던스로 이어지는지 확인해야 합니다.",
  META: "광고 단가와 참여 지표가 예상보다 강한지 다시 확인할 필요가 있습니다.",
  GOOGL: "AI 기대보다 클라우드 마진 개선이 실제 주가에는 더 중요합니다.",
  AAPL: "AI 제품 서사가 실제 가격 추세로 이어지는지 확인 전까지는 보수적으로 봐야 합니다.",
  PANW: "빌링스 회복이 재확인되면 상대강도 개선 가능성이 커집니다.",
  CRWD: "이전 고점 근처에서 거래량이 다시 붙는지 여부가 중요합니다.",
  PLTR: "상업 부문 파이프라인이 실제 매출 전환으로 이어지는지 봐야 합니다.",
  VRT: "수주 잔고와 냉각 수요 업데이트가 다음 방향성을 결정할 수 있습니다.",
  ETN: "백로그 유지와 가격 결정력이 계속 이어지는지 확인이 필요합니다.",
  GEV: "주문 유입과 마진 개선이 함께 이어지는지가 핵심입니다.",
  CEG: "장기 전력 계약 뉴스가 추가 상승 촉매가 될 수 있습니다.",
  RTX: "프로그램 실행 품질이 단기 헤드라인보다 더 중요합니다.",
  LMT: "백로그는 좋지만 추세 가속이 붙는지 추가 확인이 필요합니다.",
  LLY: "생산 능력 확대와 공급 업데이트가 다시 나오면 추세 재개 가능성이 있습니다.",
  TSLA: "마진 압박과 헤드라인 리스크가 커서 지금은 공격적으로 볼 구간이 아닙니다."
};

export function displayRegime(regime: MarketRegime): string {
  return regimeMap[regime];
}

export function displayRuntimeMode(mode: ProviderRuntime): string {
  return runtimeMap[mode];
}

export function displayCandidateLabel(label: CandidateLabel): string {
  return candidateLabelMap[label];
}

export function displaySeverity(severity: AlertSeverity): string {
  return severityMap[severity];
}

export function displayImpact(impact: ImpactLevel): string {
  return impactMap[impact];
}

export function displayUniverse(key: UniverseKey): string {
  return universeMap[key];
}

export function displaySector(name: string): string {
  return sectorMap[name] ?? name;
}

export function displayTheme(name: string): string {
  return themeMap[name] ?? name;
}

export function displaySectorFilter(option: string): string {
  return option === "All" ? "전체" : displaySector(option);
}

export function displayThemes(names: string[]): string {
  return names.map((name) => displayTheme(name)).join(", ");
}

export function getLocalizedStockDescription(ticker: string, fallback: string): string {
  return stockDescriptionMap[ticker] ?? fallback;
}

export function getLocalizedStockEventNote(ticker: string, fallback: string): string {
  return stockEventNoteMap[ticker] ?? fallback;
}
