import { clamp, formatCurrency } from "@/lib/utils";
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

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function buildScenario(candidate: OvernightRawCandidate) {
  const continuationTarget = Math.max(candidate.resistanceLevel, candidate.close * 1.03);
  const reboundTarget = Math.max(candidate.close, candidate.supportLevel * 1.025);

  return {
    primary: `${formatCurrency(candidate.close)} 위에서 버티며 ${formatCurrency(candidate.resistanceLevel)} 돌파 시 ${formatCurrency(
      continuationTarget
    )}까지 갭 연장 시나리오`,
    alternate: `${formatCurrency(candidate.supportLevel)} 눌림 지지가 확인되면 ${formatCurrency(
      reboundTarget
    )} 회복 플레이, ${formatCurrency(candidate.supportLevel * 0.985)} 이탈 시 관망`,
    exitPlan: `익일 갭 상승 시 장초반 ${formatCurrency(candidate.resistanceLevel)} 부근 분할 청산, 힘이 약하면 VWAP 재이탈 구간에서 정리`
  };
}

export function scoreOvernightCandidate(raw: OvernightRawCandidate, settings: OvernightSettings): OvernightCandidate {
  const liquidity =
    (scale(raw.averageVolume, 1_000_000, 12_000_000) * 0.3 +
      scale(raw.averageDollarVolumeM, 20, 500) * 0.3 +
      scale(raw.marketCapBn, 2, 150) * 0.2 +
      invertScale(raw.spreadBps, 5, 90) * 0.2) /
    100 *
    settings.weights.liquidity;

  const closeToHighPct = clamp(((raw.dayHigh - raw.close) / raw.dayHigh) * 100, 0, 100);
  const closeAboveVWAPPct = ((raw.close - raw.vwap) / raw.vwap) * 100;
  const intradayStrength =
    (scale(raw.dayChangePct, 0, 9) * 0.28 +
      invertScale(closeToHighPct, 0, 4) * 0.24 +
      scale(closeAboveVWAPPct, 0, 2.8) * 0.18 +
      scale(raw.closeStrength30m, 0, 5) * 0.3) /
    100 *
    settings.weights.intradayStrength;

  const flowVolume =
    (scale(raw.rvol20, 1, 4.5) * 0.38 +
      scale(raw.close30mVolumeRatio, 0.8, 2.5) * 0.24 +
      scale(raw.closeAuctionConcentration, 8, 32) * 0.22 +
      invertScale(raw.heavySelloffPenalty, 0, 25) * 0.16) /
    100 *
    settings.weights.flowVolume;

  const catalystBase =
    raw.earningsSurpriseScore * 0.2 +
    raw.guidanceScore * 0.16 +
    raw.contractScore * 0.14 +
    raw.policyScore * 0.1 +
    raw.analystScore * 0.1 +
    raw.themeScore * 0.12 +
    raw.sectorMomentumScore * 0.18 * settings.sectorWeightMultiplier -
    (raw.negativeHeadlinePenalty * 0.16 + raw.dilutionPenalty * 0.08 + raw.litigationPenalty * 0.08) * settings.newsWeightMultiplier;
  const catalystMomentum = clamp(catalystBase, 0, 100) / 100 * settings.weights.catalystMomentum;

  const nextDayRealizabilityBase =
    scale(raw.premarketInterestScore, 35, 95) * 0.28 +
    scale(raw.afterHoursVolumeRatio, 0.4, 2.2) * 0.2 +
    scale(raw.afterHoursSpreadStable, 30, 95) * 0.14 +
    scale(raw.distanceToResistancePct, 1.5, 9) * 0.16 +
    invertScale(raw.daysToEarnings, 0, 4) * 0.22;
  const nextDayRealizability = clamp(nextDayRealizabilityBase, 0, 100) / 100 * settings.weights.nextDayRealizability;

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

  const reasons = [
    raw.dayChangePct >= 3
      ? `당일 ${raw.dayChangePct.toFixed(1)}% 상승으로 종가베팅 강도가 살아 있습니다.`
      : "당일 상승폭은 크지 않아도 종가 위치가 상대적으로 단단합니다.",
    raw.rvol20 >= 1.6
      ? `RVOL ${raw.rvol20.toFixed(2)}배로 거래량 확장이 동반됐습니다.`
      : `RVOL ${raw.rvol20.toFixed(2)}배로 거래량은 무난한 수준입니다.`,
    raw.news[0]?.summary ?? "섹터 모멘텀과 뉴스 재료가 익일 갭 기대를 뒷받침합니다."
  ];

  const risks = [
    raw.daysToEarnings <= 3 ? `실적 발표가 ${raw.daysToEarnings}일 남아 변동성 리스크가 큽니다.` : "익일 저항 부근에서 갭 실패 시 바로 힘이 꺾일 수 있습니다.",
    raw.negativeHeadlinePenalty > 12 ? "부정 뉴스나 희석성 리스크가 아직 남아 있습니다." : "장막판 강도가 약해지면 종가베팅 메리트가 빠르게 줄 수 있습니다.",
    raw.spreadBps > 45 ? `스프레드 ${raw.spreadBps.toFixed(0)}bp로 체결 품질이 완전히 매끈하진 않습니다.` : "익일 시초 갭이 작으면 기대손익비가 낮아질 수 있습니다."
  ];

  return {
    ticker: raw.ticker,
    companyName: raw.companyName,
    sector: raw.sector,
    industry: raw.industry,
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
    daysToEarnings: raw.daysToEarnings,
    sectorMomentumScore: raw.sectorMomentumScore,
    supportLevel: raw.supportLevel,
    resistanceLevel: raw.resistanceLevel,
    postMarketSuitability: raw.postMarketSuitability,
    score,
    reasons,
    risks,
    coreSummary: `${raw.sector} 모멘텀과 장막판 강도가 동시에 살아 있어 익일 갭/시초 강세 후보로 볼 수 있습니다.`,
    scenario: buildScenario(raw),
    entryIdea: `장마감 직전 ${formatCurrency(raw.close)} 부근에서 체결 확인 후 진입, 포스트마켓은 ${raw.postMarketSuitability === "ideal" ? "허용" : "보수적 접근"} 기준입니다.`,
    exitIdea: `익일 갭 시초 강세가 나오면 ${formatCurrency(raw.resistanceLevel)} 전후 1차 청산, 힘이 약하면 장초반 VWAP 이탈 시 정리합니다.`,
    closeTapeNote: `마감 30분 강도 ${raw.closeStrength30m.toFixed(1)} / 거래량 유지 ${raw.close30mVolumeRatio.toFixed(2)}배 / 종가 고가 근접 ${closeToHighPct.toFixed(1)}%.`,
    overnightRiskNote: `실적 ${raw.daysToEarnings}일 전, 저항까지 ${raw.distanceToResistancePct.toFixed(1)}%, 애프터마켓 ${raw.afterHoursChangePct >= 0 ? "+" : ""}${raw.afterHoursChangePct.toFixed(1)}%.`,
    news: raw.news
  };
}
