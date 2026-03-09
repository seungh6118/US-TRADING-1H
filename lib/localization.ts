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
  Watch: "감시",
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
  sp500: "S&P500 리더",
  nasdaq100: "나스닥100 중심",
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
  NVDA: "하이퍼스케일러와 국가 단위 AI 투자 확대의 수혜를 받는 AI 가속기 핵심 기업입니다.",
  AVGO: "커스텀 AI ASIC과 네트워킹 수요가 이어지며 실적 추정치가 계속 상향되는 반도체 리더입니다.",
  AMD: "서버 믹스 개선과 AI 가속기 노출로 재평가 여지가 있는 2선 AI 반도체 종목입니다.",
  SMCI: "AI 서버 인프라 수혜주이지만 이벤트에 따라 갭 변동성이 매우 큰 종목입니다.",
  MSFT: "AI 수익화와 클라우드 방어력이 동시에 유지되는 메가캡 플랫폼입니다.",
  AMZN: "AWS 회복과 리테일 마진 개선이 함께 진행되는 대형 성장주입니다.",
  META: "광고 수익성과 참여도가 강하고 AI 투자 부담도 통제 가능한 상태입니다.",
  GOOGL: "클라우드 수익성 개선과 AI 제품 사이클이 검색 우려를 일부 상쇄하고 있습니다.",
  AAPL: "서비스와 설치 기반은 안정적이지만 상대 강도는 아직 평균 수준입니다.",
  PANW: "플랫폼 통합 스토리와 빌링 가시성 개선이 맞물리는 사이버보안 대형주입니다.",
  CRWD: "기관 수급과 성장률이 모두 강한 대표 사이버보안 리더입니다.",
  PLTR: "정부와 상업 부문 AI 플랫폼 수요가 이어지지만 과열 리스크도 함께 존재합니다.",
  VRT: "AI 데이터센터 전력 체인 수혜주로 눌림목 구간에서 다시 관심을 받는 종목입니다.",
  ETN: "전력망 투자와 전기화 수요가 맞물리는 견조한 산업 리더입니다.",
  GEV: "전력망 현대화와 전력 장비 수요 확대로 중기 추세가 유지되는 종목입니다.",
  CEG: "전력 부족과 원자력 기저부하 수요 증가의 수혜를 받는 전력 테마 핵심주입니다.",
  RTX: "방산 백로그는 견조하지만 가격 추세는 성장 리더보다 덜 급한 편입니다.",
  LMT: "방어적 상대강도는 있으나 추세 가속은 아직 제한적인 전통 방산주입니다.",
  LLY: "GLP-1 리더십은 유지되지만 최근에는 가격 소화 과정이 필요한 구간입니다.",
  TSLA: "헤드라인에 크게 흔들리고 상대강도와 실행 리스크 모두 부담스러운 상태입니다."
};

const stockEventNoteMap: Record<string, string> = {
  NVDA: "클라우드 투자 코멘트가 다음 핵심 촉매입니다.",
  AVGO: "커스텀 AI ASIC 출하 흐름이 가장 중요한 확인 포인트입니다.",
  AMD: "MI 시리즈 수요 확인이 나오면 리셋된 기대감이 다시 살아날 수 있습니다.",
  SMCI: "재고와 마진 관련 코멘트가 주가 반응을 크게 좌우할 가능성이 높습니다.",
  MSFT: "Azure 성장률과 Copilot 부가 매출이 다음 체크포인트입니다.",
  AMZN: "AWS AI 서비스 수요가 다음 추세 확인 포인트입니다.",
  META: "참여도와 광고 단가 흐름이 가장 깔끔한 촉매입니다.",
  GOOGL: "AI 헤드라인보다 클라우드 재가속 여부가 더 중요합니다.",
  AAPL: "AI 제품 서사가 실제 가격 확인으로 이어질 때까지는 보수적으로 봐야 합니다.",
  PANW: "빌링 재가속이 확인되면 상대강도가 다시 살아날 수 있습니다.",
  CRWD: "이전 피벗 위에서 거래량이 유지되는지가 핵심입니다.",
  PLTR: "상업 부문 파이프라인의 실제 전환 속도가 중요합니다.",
  VRT: "냉각 수요와 수주 잔고 업데이트가 다음 확인 변수입니다.",
  ETN: "백로그 품질과 가격 결정력이 계속 유지되는지 봐야 합니다.",
  GEV: "주문 유입과 마진 개선이 이어지는지가 중요합니다.",
  CEG: "장기 전력 계약 뉴스가 나오면 추가 상승 촉매가 될 수 있습니다.",
  RTX: "프로그램 실행 품질이 헤드라인보다 더 중요합니다.",
  LMT: "백로그는 좋지만 추세 가속이 붙는지 확인이 필요합니다.",
  LLY: "생산능력 확대 업데이트가 나오면 추세 재개 가능성이 커집니다.",
  TSLA: "마진 압박과 헤드라인 변동성 때문에 현재 리스크 프로필이 좋지 않습니다."
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
  return names.map((name) => displayTheme(name)).join(" / ");
}

export function getLocalizedStockDescription(ticker: string, fallback: string): string {
  return stockDescriptionMap[ticker] ?? fallback;
}

export function getLocalizedStockEventNote(ticker: string, fallback: string): string {
  return stockEventNoteMap[ticker] ?? fallback;
}