import { clamp, formatCurrency, round1 } from "@/lib/utils";
import {
  OvernightCandidate,
  OvernightGrade,
  OvernightRawCandidate,
  OvernightScoreBreakdown,
  OvernightSettings
} from "@/lib/overnight-types";

function scale(value: number, min: number, max: number): number {
  if (max <= min) {
    return 0;
  }

  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

function invertScale(value: number, min: number, max: number): number {
  return 100 - scale(value, min, max);
}

function logScale(value: number, min: number, max: number): number {
  if (value <= 0 || min <= 0 || max <= min) {
    return 0;
  }

  const safeValue = Math.max(value, min);
  const logValue = Math.log10(safeValue);
  const logMin = Math.log10(min);
  const logMax = Math.log10(max);
  return clamp(((logValue - logMin) / (logMax - logMin)) * 100, 0, 100);
}

function weightedCategoryScore(normalized: number, weight: number, baseFloor: number, slope: number) {
  return ((baseFloor + clamp(normalized, 0, 100) * slope) / 100) * weight;
}

function gradeFor(total: number): OvernightGrade {
  if (total >= 85) {
    return "A";
  }
  if (total >= 75) {
    return "B";
  }
  if (total >= 65) {
    return "C";
  }
  return "Excluded";
}

function buildScenario(candidate: OvernightRawCandidate) {
  const continuationTarget = Math.max(candidate.resistanceLevel, candidate.close * 1.02);
  const bounceTarget = Math.max(candidate.close * 1.006, candidate.supportLevel * 1.02);
  const invalidation = candidate.supportLevel * 0.99;

  return {
    primary: `${formatCurrency(candidate.close)} 부근 종가가 유지되고 익일 초반 거래량이 따라오면 ${formatCurrency(
      continuationTarget
    )} 테스트 시나리오입니다.`,
    alternate: `${formatCurrency(candidate.supportLevel)} 지지 확인 뒤 반등하면 ${formatCurrency(
      bounceTarget
    )}까지 짧게 보는 보수적 시나리오입니다.`,
    exitPlan: `익일 시초가가 강하면 ${formatCurrency(candidate.resistanceLevel)} 근처 1차 청산, 시가가 약하면 5분 VWAP 이탈 시 빠르게 정리하는 구조가 적합합니다.`
  };
}

export function scoreOvernightCandidate(raw: OvernightRawCandidate, settings: OvernightSettings): OvernightCandidate {
  const earningsRiskDays = raw.daysToEarnings >= 0 ? raw.daysToEarnings : 999;

  const liquidityNormalized =
    logScale(raw.averageVolume, 1_000_000, 120_000_000) * 0.28 +
    logScale(raw.averageDollarVolumeM, 20, 10_000) * 0.34 +
    logScale(raw.marketCapBn, 2, 2_000) * 0.18 +
    invertScale(raw.spreadBps, 8, 60) * 0.2;
  const liquidity = weightedCategoryScore(liquidityNormalized, settings.weights.liquidity, 28, 0.72);

  const closeToHighPct = clamp(((raw.dayHigh - raw.close) / raw.dayHigh) * 100, 0, 100);
  const closeAboveVWAPPct = raw.vwap > 0 ? ((raw.close - raw.vwap) / raw.vwap) * 100 : 0;
  const intradayNormalized =
    scale(raw.dayChangePct, -2, 12) * 0.36 +
    invertScale(closeToHighPct, 0, 6) * 0.2 +
    scale(closeAboveVWAPPct, -0.4, 2.4) * 0.16 +
    scale(raw.closeStrength30m, -0.8, 3.2) * 0.2 +
    scale(raw.afterHoursChangePct, -1.2, 2.5) * 0.08;
  const intradayStrength = weightedCategoryScore(intradayNormalized, settings.weights.intradayStrength, 24, 0.76);

  const flowNormalized =
    scale(raw.rvol20, 0.85, 5) * 0.34 +
    scale(raw.close30mVolumeRatio, 0.9, 3) * 0.22 +
    scale(raw.closeAuctionConcentration, 7, 18) * 0.16 +
    invertScale(raw.heavySelloffPenalty, 0, 25) * 0.18 +
    scale(raw.afterHoursVolumeRatio, 0.0, 0.08) * 0.1;
  const flowVolume = weightedCategoryScore(flowNormalized, settings.weights.flowVolume, 22, 0.74);

  const screenerMomentumBonus =
    (raw.universeTags.includes("day_gainers") ? 16 : 0) +
    (raw.universeTags.includes("most_actives") ? 9 : 0) +
    (raw.universeTags.includes("growth_technology_stocks") ? 11 : 0) +
    (raw.dayChangePct >= 5 ? 7 : raw.dayChangePct >= 2 ? 4 : 0) +
    (raw.afterHoursChangePct >= 0.5 ? 4 : raw.afterHoursChangePct > 0 ? 2 : 0);
  const catalystNormalized =
    raw.earningsSurpriseScore * 0.18 +
    raw.guidanceScore * 0.14 +
    raw.contractScore * 0.12 +
    raw.policyScore * 0.08 +
    raw.analystScore * 0.14 +
    raw.themeScore * 0.16 +
    raw.sectorMomentumScore * 0.18 * settings.sectorWeightMultiplier +
    screenerMomentumBonus -
    (raw.negativeHeadlinePenalty * 0.11 + raw.dilutionPenalty * 0.08 + raw.litigationPenalty * 0.08) * settings.newsWeightMultiplier;
  const catalystMomentum = weightedCategoryScore(
    clamp(catalystNormalized, 0, 100),
    settings.weights.catalystMomentum,
    24,
    0.76
  );

  const backtestSignalScore = clamp(
    raw.backtest.gapUpRatePct * 0.8 + raw.backtest.averageMaxGainPct * 5 + raw.backtest.averageGapPct * 2 + 20,
    10,
    95
  );
  const nextDayNormalized =
    scale(raw.premarketInterestScore, 45, 95) * 0.26 +
    scale(raw.afterHoursVolumeRatio, 0.0, 0.08) * 0.16 +
    scale(raw.afterHoursChangePct, -1, 2.5) * 0.1 +
    scale(raw.afterHoursSpreadStable, 35, 95) * 0.12 +
    scale(raw.distanceToResistancePct, 1, 9) * 0.14 +
    scale(Math.min(earningsRiskDays, 14), 3, 14) * 0.12 +
    backtestSignalScore * 0.1;
  const nextDayRealizability = weightedCategoryScore(
    clamp(nextDayNormalized, 0, 100),
    settings.weights.nextDayRealizability,
    20,
    0.78
  );

  const total = round1(liquidity + intradayStrength + flowVolume + catalystMomentum + nextDayRealizability);
  const score: OvernightScoreBreakdown = {
    liquidity: round1(liquidity),
    intradayStrength: round1(intradayStrength),
    flowVolume: round1(flowVolume),
    catalystMomentum: round1(catalystMomentum),
    nextDayRealizability: round1(nextDayRealizability),
    total,
    grade: gradeFor(total)
  };

  const positiveNewsCount = raw.news.filter((item) => item.sentiment === "positive").length;
  const negativeNewsCount = raw.news.filter((item) => item.sentiment === "negative").length;

  const reasons = [
    `당일 ${raw.dayChangePct >= 0 ? "상승" : "하락"} ${raw.dayChangePct.toFixed(1)}%, VWAP 대비 ${
      closeAboveVWAPPct >= 0 ? "+" : ""
    }${closeAboveVWAPPct.toFixed(1)}%로 종가 강도가 유지됐습니다.`,
    `RVOL ${raw.rvol20.toFixed(2)}배, 마감 30분 거래량 ${raw.close30mVolumeRatio.toFixed(
      2
    )}배로 종가 직전 수급이 버텼습니다.`,
    positiveNewsCount > 0
      ? `오늘 긍정 뉴스 ${positiveNewsCount}건이 붙었고 핵심 재료는 ${raw.news[0]?.catalyst ?? "theme"} 계열입니다.`
      : `${raw.sector} / ${raw.industry} 흐름과 스크리너 모멘텀이 종가 베팅 점수를 지지합니다.`
  ];

  const risks = [
    earningsRiskDays <= 3
      ? `실적 발표가 ${earningsRiskDays}일 안에 있어 익일 갭 방향보다 변동성 리스크가 더 커질 수 있습니다.`
      : `직전 일봉 저항까지 ${raw.distanceToResistancePct.toFixed(1)}% 남아 있어 시초가가 약하면 바로 매물 저항을 만날 수 있습니다.`,
    negativeNewsCount > 0
      ? `부정 뉴스 ${negativeNewsCount}건이 남아 있어 갭 상승 후 되밀림 가능성을 열어둬야 합니다.`
      : `포스트마켓 적합도는 ${raw.postMarketSuitability} 단계이며 스프레드 ${raw.spreadBps.toFixed(0)}bp는 체크가 필요합니다.`,
    raw.backtest.sampleSize >= 5
      ? `최근 ${raw.backtest.sampleSize}회 프록시 백테스트 기준 평균 갭 ${raw.backtest.averageGapPct.toFixed(
          1
        )}%입니다. 기대값이 과장되지 않게 봐야 합니다.`
      : "백테스트 표본이 적어 과거 통계는 참고용으로만 해석해야 합니다."
  ];

  return {
    ticker: raw.ticker,
    companyName: raw.companyName,
    sector: raw.sector,
    industry: raw.industry,
    universeTags: raw.universeTags,
    price: raw.price,
    dayChangePct: raw.dayChangePct,
    afterHoursChangePct: raw.afterHoursChangePct,
    averageVolume: raw.averageVolume,
    averageDollarVolumeM: raw.averageDollarVolumeM,
    marketCapBn: raw.marketCapBn,
    spreadBps: raw.spreadBps,
    closeToHighPct: round1(closeToHighPct),
    closeAboveVWAPPct: round1(closeAboveVWAPPct),
    closeStrength30m: raw.closeStrength30m,
    close30mVolumeRatio: raw.close30mVolumeRatio,
    rvol20: raw.rvol20,
    closeAuctionConcentration: raw.closeAuctionConcentration,
    distanceToResistancePct: raw.distanceToResistancePct,
    daysToEarnings: earningsRiskDays,
    sectorMomentumScore: raw.sectorMomentumScore,
    supportLevel: raw.supportLevel,
    resistanceLevel: raw.resistanceLevel,
    postMarketSuitability: raw.postMarketSuitability,
    marketState: raw.marketState,
    score,
    reasons,
    risks,
    coreSummary: `${raw.sector} 내 ${raw.industry} 흐름과 종가 직전 체결 강도가 함께 살아 있어 2~3일 오버나이트 후보로 볼 수 있습니다.`,
    scenario: buildScenario(raw),
    entryIdea: `${formatCurrency(raw.close)} 부근에서 종가 지지가 유지되고 포스트마켓 체결이 급격히 얇아지지 않을 때만 진입하는 보수적 접근이 적합합니다.`,
    exitIdea: `익일 시초 갭이 강하면 ${formatCurrency(raw.resistanceLevel)} 부근 1차 청산, 시가가 약하면 초기 5분 VWAP 이탈 시 빠르게 정리하는 방식이 좋습니다.`,
    closeTapeNote: `종가-고가 거리 ${closeToHighPct.toFixed(1)}%, 마감 30분 강도 ${raw.closeStrength30m.toFixed(
      1
    )}%, 마감 구간 거래량 ${raw.close30mVolumeRatio.toFixed(2)}배입니다.`,
    overnightRiskNote: `애프터마켓 ${raw.afterHoursChangePct >= 0 ? "+" : ""}${raw.afterHoursChangePct.toFixed(
      1
    )}%, 다음 실적까지 ${earningsRiskDays}일, 직전 저항까지 ${raw.distanceToResistancePct.toFixed(1)}%입니다.`,
    news: raw.news,
    backtest: raw.backtest
  };
}
