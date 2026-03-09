import { riskWindows, scoreWeights } from "@/lib/config";
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

  return clamp(sector.score * 0.65 + sector.relativeStrength * 20 + sector.performance20dPct * 0.5 + sector.performance5dPct * 0.25);
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
  const acceleration = stock.quote.change5dPct - stock.quote.change20dPct / 4;
  return clamp(42 + stock.technicals.volumeRatio * 24 + acceleration * 2.2 + stock.quote.change1dPct * 3.4);
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
  if (score.finalScore < 48 || score.riskPenalty >= 18) {
    return "Avoid";
  }
  if (earningsDays <= riskWindows.earningsDays && score.finalScore >= 58) {
    return "Earnings watch";
  }
  if (score.priceStructure >= 76 && stock.technicals.volumeRatio >= 1.2 && stock.technicals.distanceFromHighPct <= 4.5) {
    return "Breakout candidate";
  }
  if (score.priceStructure >= 68 && stock.technicals.pullbackDepthPct >= 3 && stock.technicals.pullbackDepthPct <= 8) {
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
  const sector = getSectorScore(stock, []);
  const whyWatch = [
    `${stock.profile.sector} is one of the stronger groups for this market regime.`,
    `Price structure score is ${score.priceStructure.toFixed(0)}, keeping ${stock.profile.ticker} on the shortlist.`,
    `${stock.profile.themes.join(" / ")} exposure aligns with the current tape.`
  ];

  const whyNotYet = [
    score.riskPenalty >= 9 ? `Event risk is elevated ahead of ${daysUntil(stock.earnings.nextEarningsDate)}-day earnings.` : `The setup still needs cleaner follow-through through the trigger zone.`,
    stock.technicals.volumeRatio < 1.1 ? "Volume confirmation is not decisive yet." : "Recent activity is constructive, but not enough to ignore invalidation.",
    label === "Avoid" ? "Relative trend is too fragile for a fresh swing setup." : `Risk penalty of ${score.riskPenalty.toFixed(1)} means timing matters.`
  ];

  const keyLevels = buildKeyLevels(stock);
  return {
    whyWatch,
    whyNotYet,
    confirmation: [
      `Hold above ${keyLevels.support.toFixed(2)} while sector strength stays firm.`,
      `Break ${keyLevels.breakout.toFixed(2)} on expanding volume.`,
      `See follow-through from the next catalyst rather than a one-day spike.`
    ],
    invalidation: [
      `Loss of ${keyLevels.invalidation.toFixed(2)} would damage the swing thesis.`,
      `A new wave of negative revisions would reduce the news/earnings score.`,
      `Macro tone rolling from risk-on to neutral would lower conviction.`
    ],
    bullishFactors: [
      `${stock.profile.themes.join(" and ")} remain investable themes.`,
      `20/50/200 trend alignment is ${stock.technicals.ma20 > stock.technicals.ma50 && stock.technicals.ma50 > stock.technicals.ma200 ? "healthy" : "mixed but improving"}.`
    ],
    bearishFactors: [
      `Risk penalty sits at ${score.riskPenalty.toFixed(1)}.`,
      `${stock.technicals.distanceFromHighPct.toFixed(1)}% distance from the 52-week high can still widen if the tape weakens.`
    ],
    whatToWatchNext: [
      `Watch ${keyLevels.breakout.toFixed(2)} as the next acceptance level.`,
      `Watch volume ratio around ${stock.technicals.volumeRatio.toFixed(2)} for confirmation.`
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
        title: `${event.title} in focus`,
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
        title: `${candidate.profile.ticker} earnings nearby`,
        reason: `Catalyst risk arrives in ${earningsDays} day(s).`,
        severity: earningsDays <= 3 ? "high" : "medium",
        category: "earnings"
      });
    }
    if (candidate.technicals.atrPct >= riskWindows.highVolatilityAtrPct) {
      alerts.push({
        id: `${candidate.profile.ticker}-vol-alert`,
        ticker: candidate.profile.ticker,
        title: `${candidate.profile.ticker} volatility elevated`,
        reason: `ATR-based volatility is ${candidate.technicals.atrPct.toFixed(1)}%.`,
        severity: "medium",
        category: "volatility"
      });
    }
    if (candidate.quote.change20dPct >= riskWindows.overextended20dPct) {
      alerts.push({
        id: `${candidate.profile.ticker}-chase-alert`,
        ticker: candidate.profile.ticker,
        title: `${candidate.profile.ticker} chase risk`,
        reason: `20-day move of ${candidate.quote.change20dPct.toFixed(1)}% raises pullback risk.`,
        severity: "medium",
        category: "overextended"
      });
    }
    if (candidate.recentNews.some((item) => item.sentimentScore < -0.15)) {
      alerts.push({
        id: `${candidate.profile.ticker}-headline-alert`,
        ticker: candidate.profile.ticker,
        title: `${candidate.profile.ticker} headline risk`,
        reason: `Recent news flow is net negative and deserves caution.`,
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
