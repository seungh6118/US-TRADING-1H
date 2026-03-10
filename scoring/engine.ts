import { riskWindows, scoreWeights } from "@/lib/config";
import { displaySector, displayThemes } from "@/lib/localization";
import {
  CandidateLabel,
  CandidateStock,
  MarketMacroSnapshot,
  RiskAlert,
  ScoreBreakdown,
  SectorPerformance,
  StockNarrative,
  StockSnapshot,
  ThemeSnapshot
} from "@/lib/types";
import { clamp, daysUntil } from "@/lib/utils";

type ScoreContext = {
  market: MarketMacroSnapshot;
  sectors: SectorPerformance[];
  themes: ThemeSnapshot[];
};

const growthSectors = new Set([
  "Semiconductors",
  "Mega-Cap Platforms",
  "Cybersecurity",
  "Power Infrastructure"
]);

const defensiveSectors = new Set(["Utilities & Nuclear", "Defense", "Healthcare"]);

function getSectorScore(stock: StockSnapshot, sectors: SectorPerformance[]) {
  return sectors.find((sector) => sector.sector === stock.profile.sector);
}

function getThemeScores(stock: StockSnapshot, themes: ThemeSnapshot[]) {
  return stock.profile.themes
    .map((themeName) => themes.find((theme) => theme.name === themeName)?.score)
    .filter((score): score is number => score !== undefined);
}

function scoreMacroFit(stock: StockSnapshot, market: MarketMacroSnapshot): number {
  let score = 52;
  if (market.regime === "risk-on") {
    score += growthSectors.has(stock.profile.sector) ? 18 : 6;
    score += stock.fundamentals.beta > 1.1 ? 8 : 3;
  }
  if (market.regime === "risk-off") {
    score += defensiveSectors.has(stock.profile.sector) ? 14 : -10;
  }

  if (stock.quote.change1dPct < 0 && stock.quote.change5dPct < 0) {
    score -= 8;
  }
  if (stock.profile.sector === "Defense" && stock.quote.change1dPct < 0) {
    score -= 10;
  }
  if (stock.profile.sector === "Power Infrastructure" && stock.profile.themes.includes("AI") && stock.quote.change1dPct > 0) {
    score += 6;
  }

  const vix = market.macroAssets.find((asset) => asset.symbol.includes("VIX"));
  const dxy = market.macroAssets.find((asset) => asset.symbol.includes("DXY") || asset.name.includes("DXY"));
  if ((vix?.value ?? 20) < 16) {
    score += 6;
  }
  if ((dxy?.change5dPct ?? 0) < 0 && growthSectors.has(stock.profile.sector)) {
    score += 5;
  }

  return clamp(score);
}

function scoreSectorStrength(stock: StockSnapshot, sectors: SectorPerformance[]): number {
  const sector = getSectorScore(stock, sectors);
  if (!sector) {
    return 50;
  }

  return clamp(
    sector.score * 0.45 +
      sector.relativeStrength * 14 +
      sector.performance1dPct * 4.5 +
      sector.performance5dPct * 1.2 +
      sector.performance20dPct * 0.2
  );
}

function scoreThemeStrength(stock: StockSnapshot, themes: ThemeSnapshot[]): number {
  const scores = getThemeScores(stock, themes);
  if (scores.length === 0) {
    return 45;
  }

  return clamp(scores.reduce((sum, value) => sum + value, 0) / scores.length);
}

function scoreEarningsNews(stock: StockSnapshot): number {
  const guidanceBonus = stock.earnings.guidance === "raised" ? 12 : stock.earnings.guidance === "inline" ? 4 : -12;
  const newsContribution =
    stock.recentNews.reduce((sum, item) => sum + (item.sentimentScore + 1) * 25 * item.importanceScore, 0) /
    Math.max(stock.recentNews.length, 1);

  return clamp(
    45 +
      stock.earnings.revenueGrowthPct * 0.35 +
      stock.earnings.epsSurprisePct * 1.6 +
      guidanceBonus +
      stock.earnings.epsRevisionScore * 0.18 +
      newsContribution * 0.22
  );
}

function scorePriceStructure(stock: StockSnapshot): number {
  let score = 25;
  const { ma20, ma50, ma200, distanceFromHighPct, volumeRatio, pullbackDepthPct } = stock.technicals;
  if (ma20 > ma50 && ma50 > ma200) {
    score += 35;
  } else if (ma20 > ma50) {
    score += 20;
  } else if (ma50 > ma200) {
    score += 12;
  }

  if (distanceFromHighPct <= 4) {
    score += 18;
  } else if (distanceFromHighPct <= 8) {
    score += 12;
  } else if (distanceFromHighPct <= 14) {
    score += 6;
  }

  if (stock.quote.change20dPct > 0) {
    score += 10;
  }
  if (pullbackDepthPct >= 2 && pullbackDepthPct <= 8 && stock.quote.change5dPct > 0) {
    score += 8;
  }
  if (volumeRatio >= 1.2 && stock.quote.change1dPct > 0) {
    score += 8;
  }

  return clamp(score);
}

function scoreFlowVolume(stock: StockSnapshot): number {
  let score = 38 + stock.technicals.volumeRatio * 18 + stock.quote.change1dPct * 5.5 + stock.quote.change5dPct * 2.4 + stock.quote.change20dPct * 0.4;

  if (stock.quote.change1dPct > 0 && stock.technicals.volumeRatio >= 1.2) {
    score += 8;
  }
  if (stock.quote.change1dPct < 0 && stock.quote.change5dPct < 0) {
    score -= 14;
  }
  if (stock.quote.change1dPct < 0 && stock.technicals.volumeRatio > 1.15) {
    score -= 4;
  }

  return clamp(score);
}

function scoreValuationSanity(stock: StockSnapshot): number {
  let score = 60;
  const pe = stock.fundamentals.pe;
  const ps = stock.fundamentals.priceToSales;

  if (pe !== null) {
    if (growthSectors.has(stock.profile.sector)) {
      score += pe <= 55 ? 12 : pe <= 80 ? 4 : -10;
    } else {
      score += pe <= 30 ? 12 : pe <= 45 ? 5 : -8;
    }
  }

  if (ps !== null) {
    score += ps <= 12 ? 10 : ps <= 20 ? 3 : -10;
  }

  return clamp(score);
}

function scoreRiskPenalty(stock: StockSnapshot): number {
  let penalty = 0;
  const earningsDays = daysUntil(stock.earnings.nextEarningsDate);

  if (earningsDays <= riskWindows.earningsDays) {
    penalty += 9;
  }
  if (stock.technicals.atrPct >= riskWindows.highVolatilityAtrPct) {
    penalty += 5;
  }
  if (stock.quote.change20dPct >= riskWindows.overextended20dPct) {
    penalty += 5;
  }
  if (stock.technicals.distanceFromHighPct < 1.5 && stock.technicals.volumeRatio > 1.6) {
    penalty += 3;
  }
  if (stock.recentNews.some((item) => item.sentimentScore < -0.15)) {
    penalty += 6;
  }
  if (stock.earnings.guidance === "cut") {
    penalty += 6;
  }

  return clamp(penalty, 0, 25);
}

function deriveLabel(stock: StockSnapshot, score: ScoreBreakdown): CandidateLabel {
  const earningsDays = daysUntil(stock.earnings.nextEarningsDate);
  const movingAverageAligned = stock.technicals.ma20 > stock.technicals.ma50 && stock.technicals.ma50 > stock.technicals.ma200;

  if (score.finalScore < 48 || score.riskPenalty >= 18) {
    return "Avoid";
  }
  if (earningsDays <= riskWindows.earningsDays && score.finalScore >= 58) {
    return "Earnings watch";
  }
  if (
    movingAverageAligned &&
    score.priceStructure >= 78 &&
    stock.technicals.volumeRatio >= 1.2 &&
    stock.technicals.distanceFromHighPct <= 4.5 &&
    stock.quote.change1dPct >= 0 &&
    stock.quote.change5dPct >= 0 &&
    stock.quote.change20dPct > 3
  ) {
    return "Breakout candidate";
  }
  if (
    score.priceStructure >= 68 &&
    stock.technicals.pullbackDepthPct >= 3 &&
    stock.technicals.pullbackDepthPct <= 10 &&
    stock.quote.change5dPct >= 0
  ) {
    return "Pullback candidate";
  }
  return score.finalScore >= 55 ? "Watch" : "Avoid";
}

function buildKeyLevels(stock: StockSnapshot) {
  const closes = stock.priceHistory.map((point) => point.close);
  const recentHigh = Math.max(...closes.slice(-20));
  const recentLow = Math.min(...closes.slice(-20));
  return {
    breakout: Number((recentHigh * 1.01).toFixed(2)),
    support: Number((Math.max(stock.technicals.ma20, recentLow) * 0.995).toFixed(2)),
    invalidation: Number((Math.min(stock.technicals.ma50, recentLow) * 0.98).toFixed(2)),
    tacticalEntry: Number((stock.quote.price * 1.005).toFixed(2))
  };
}

function buildNarrative(stock: StockSnapshot, score: ScoreBreakdown, label: CandidateLabel) {
  const keyLevels = buildKeyLevels(stock);
  const earningsDays = daysUntil(stock.earnings.nextEarningsDate);
  const aligned = stock.technicals.ma20 > stock.technicals.ma50 && stock.technicals.ma50 > stock.technicals.ma200;

  return {
    whyWatch: [
      `${displaySector(stock.profile.sector)} 섹터 강도가 현재 시장에서 상위권입니다.`,
      `가격 구조 점수 ${score.priceStructure.toFixed(0)}점으로 ${stock.profile.ticker}는 이번 주 감시 후보군에 들어갑니다.`,
      `${displayThemes(stock.profile.themes)} 테마가 최근 뉴스 흐름과 가격 반응에서 동시에 살아 있습니다.`
    ],
    whyNotYet: [
      score.riskPenalty >= 9
        ? `실적 발표가 ${earningsDays}일 앞으로 다가와 이벤트 변동성 리스크가 큽니다.`
        : "추세가 완전히 회복된 것은 아니어서 바로 추격하기보다 지지 확인이 먼저입니다.",
      stock.technicals.volumeRatio < 1.1
        ? "돌파를 정당화할 거래량 확장이 아직 충분하지 않습니다."
        : "반등은 나오고 있지만 손절 기준 없이 따라붙기에는 가격 부담이 남아 있습니다.",
      label === "Avoid"
        ? "지금은 기대수익보다 리스크가 더 커 보여 관찰 위주가 적절합니다."
        : `리스크 패널티가 ${score.riskPenalty.toFixed(1)}점이라 진입 후 손절 관리가 중요합니다.`
    ],
    confirmation: [
      `${keyLevels.support.toFixed(2)} 부근 지지가 유지되는지 확인하세요.`,
      `${keyLevels.breakout.toFixed(2)} 돌파가 거래량 증가와 함께 나오는지가 핵심입니다.`,
      "다음 체크에서 상대강도와 20일 추세가 계속 살아 있는지 점검하세요."
    ],
    invalidation: [
      `${keyLevels.invalidation.toFixed(2)} 아래로 밀리면 현재 시나리오는 무효로 보는 편이 맞습니다.`,
      "실적이나 가이던스가 다시 악화되면 점수 개선 논리는 사라집니다.",
      "시장 레짐이 다시 악화되면 우선순위를 낮춰야 합니다."
    ],
    bullishFactors: [
      `${displayThemes(stock.profile.themes)} 관련 자금 흐름이 아직 완전히 꺾이지 않았습니다.`,
      `20/50/200 이동평균 배열은 ${aligned ? "정배열 또는 그에 가까운 개선 흐름" : "아직 완전한 정배열은 아니지만 회복 시도"}입니다.`
    ],
    bearishFactors: [
      `리스크 패널티 ${score.riskPenalty.toFixed(1)}점으로 단기 이벤트 관리가 필요합니다.`,
      `52주 고점 대비 ${stock.technicals.distanceFromHighPct.toFixed(1)}% 아래에 있어 아직 확인 구간이 남아 있습니다.`
    ],
    whatToWatchNext: [
      `${keyLevels.breakout.toFixed(2)} 부근이 다음 유효 트리거입니다.`,
      `거래량 배수 ${stock.technicals.volumeRatio.toFixed(2)}배가 유지되는지 확인하세요.`
    ]
  } satisfies StockNarrative;
}

export function scoreCandidate(stock: StockSnapshot, context: ScoreContext): CandidateStock {
  const breakdown: ScoreBreakdown = {
    macroFit: scoreMacroFit(stock, context.market),
    sectorStrength: scoreSectorStrength(stock, context.sectors),
    themeStrength: scoreThemeStrength(stock, context.themes),
    earningsNews: scoreEarningsNews(stock),
    priceStructure: scorePriceStructure(stock),
    flowVolume: scoreFlowVolume(stock),
    valuationSanity: scoreValuationSanity(stock),
    riskPenalty: scoreRiskPenalty(stock),
    finalScore: 0
  };

  const weighted =
    breakdown.macroFit * scoreWeights.macroFit +
    breakdown.sectorStrength * scoreWeights.sectorStrength +
    breakdown.themeStrength * scoreWeights.themeStrength +
    breakdown.earningsNews * scoreWeights.earningsNews +
    breakdown.priceStructure * scoreWeights.priceStructure +
    breakdown.flowVolume * scoreWeights.flowVolume +
    breakdown.valuationSanity * scoreWeights.valuationSanity;

  breakdown.finalScore = clamp(weighted - breakdown.riskPenalty);
  const label = deriveLabel(stock, breakdown);
  const keyLevels = buildKeyLevels(stock);

  return {
    ...stock,
    score: breakdown,
    label,
    keyLevels,
    narrative: buildNarrative(stock, breakdown, label)
  };
}

export function buildRiskAlerts(candidates: CandidateStock[], market: MarketMacroSnapshot): RiskAlert[] {
  const alerts: RiskAlert[] = [];

  market.economicEvents.forEach((event) => {
    if (event.impact === "high") {
      alerts.push({
        id: event.id,
        title: `${event.title} 경계`,
        reason: event.note,
        severity: "medium",
        category: "macro"
      });
    }
  });

  candidates.forEach((candidate) => {
    const earningsDays = daysUntil(candidate.earnings.nextEarningsDate);
    if (earningsDays <= riskWindows.earningsDays) {
      alerts.push({
        id: `${candidate.profile.ticker}-earnings-alert`,
        ticker: candidate.profile.ticker,
        title: `${candidate.profile.ticker} 실적 임박`,
        reason: `${earningsDays}일 안에 실적 발표가 있어 이벤트 변동성이 커질 수 있습니다.`,
        severity: earningsDays <= 3 ? "high" : "medium",
        category: "earnings"
      });
    }
    if (candidate.technicals.atrPct >= riskWindows.highVolatilityAtrPct) {
      alerts.push({
        id: `${candidate.profile.ticker}-vol-alert`,
        ticker: candidate.profile.ticker,
        title: `${candidate.profile.ticker} 변동성 과열`,
        reason: `ATR 기준 변동성이 ${candidate.technicals.atrPct.toFixed(1)}%로 높은 편입니다.`,
        severity: "medium",
        category: "volatility"
      });
    }
    if (candidate.quote.change20dPct >= riskWindows.overextended20dPct) {
      alerts.push({
        id: `${candidate.profile.ticker}-chase-alert`,
        ticker: candidate.profile.ticker,
        title: `${candidate.profile.ticker} 추격 매수 경계`,
        reason: `최근 20일 상승률이 ${candidate.quote.change20dPct.toFixed(1)}%라 이격 부담이 있습니다.`,
        severity: "medium",
        category: "overextended"
      });
    }
    if (candidate.recentNews.some((item) => item.sentimentScore < -0.15)) {
      alerts.push({
        id: `${candidate.profile.ticker}-headline-alert`,
        ticker: candidate.profile.ticker,
        title: `${candidate.profile.ticker} 부정 뉴스`,
        reason: "최근 뉴스 흐름에 부정적 요소가 있어 비중 조절이 필요합니다.",
        severity: "high",
        category: "headline"
      });
    }
  });

  return alerts
    .sort((left, right) => {
      const severityRank = { high: 3, medium: 2, low: 1 };
      return severityRank[right.severity] - severityRank[left.severity];
    })
    .slice(0, 8);
}
