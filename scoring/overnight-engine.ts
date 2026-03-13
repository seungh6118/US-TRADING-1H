import { clamp, formatCurrency, round1 } from "@/lib/utils";
import {
  CatalystTag,
  OvernightCandidate,
  OvernightEntryGuide,
  OvernightGrade,
  OvernightRawCandidate,
  OvernightScoreBreakdown,
  OvernightSettings,
  PostMarketSuitability
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

function signedPercent(value: number, digits = 1) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function roundPrice(value: number) {
  return Math.round(value * 100) / 100;
}

function catalystLabel(tag: CatalystTag) {
  switch (tag) {
    case "earnings":
      return "실적";
    case "guidance":
      return "가이던스";
    case "contract":
      return "계약/수주";
    case "policy":
      return "정책";
    case "analyst":
      return "애널리스트 상향";
    case "theme":
      return "테마";
    case "dilution":
      return "희석";
    case "litigation":
      return "소송/규제";
    case "downgrade":
      return "하향";
    default:
      return "재료";
  }
}

function suitabilityLabel(value: PostMarketSuitability) {
  if (value === "ideal") {
    return "높음";
  }
  if (value === "allowed") {
    return "보통";
  }
  return "낮음";
}

function strongestCatalyst(raw: OvernightRawCandidate) {
  if ((raw.earningsSurpriseScore >= 25 || raw.guidanceScore >= 25) && raw.afterHoursChangePct > 1) {
    return {
      tag: "earnings" as const,
      label: "실적/가이던스",
      score: Math.max(raw.earningsSurpriseScore, raw.guidanceScore)
    };
  }

  const entries = [
    { tag: "earnings" as const, label: "실적 서프라이즈", score: raw.earningsSurpriseScore },
    { tag: "guidance" as const, label: "가이던스 상향", score: raw.guidanceScore },
    { tag: "contract" as const, label: "대형 계약/수주", score: raw.contractScore },
    { tag: "policy" as const, label: "정책 수혜", score: raw.policyScore },
    { tag: "analyst" as const, label: "애널리스트 상향", score: raw.analystScore },
    { tag: "theme" as const, label: "테마 모멘텀", score: raw.themeScore }
  ].sort((left, right) => right.score - left.score);

  if (raw.earningsSurpriseScore >= 35 && raw.guidanceScore >= 35) {
    return {
      tag: "earnings" as const,
      label: "실적/가이던스",
      score: Math.max(raw.earningsSurpriseScore, raw.guidanceScore)
    };
  }

  return entries[0];
}

function buildScenario(candidate: OvernightRawCandidate) {
  const continuationTarget = Math.max(candidate.resistanceLevel, candidate.close * 1.02);
  const bounceTarget = Math.max(candidate.close * 1.006, candidate.supportLevel * 1.02);
  const invalidation = candidate.supportLevel * 0.99;

  return {
    primary: `${formatCurrency(candidate.close)} 부근 종가가 유지되고 시초 거래대금이 붙으면 ${formatCurrency(
      continuationTarget
    )} 테스트 시나리오입니다.`,
    alternate: `${formatCurrency(candidate.supportLevel)} 지지를 확인한 뒤 반등하면 ${formatCurrency(
      bounceTarget
    )}까지 보는 보수적 시나리오입니다.`,
    exitPlan: `${formatCurrency(candidate.resistanceLevel)} 부근 1차 청산, 시초가가 밀리면 5분 VWAP 이탈 시 빠르게 정리하는 구조가 좋습니다. 무효화 레벨은 ${formatCurrency(
      invalidation
    )}입니다.`
  };
}

function buildEntryGuide(candidate: OvernightRawCandidate): OvernightEntryGuide {
  const closeBuffer = candidate.close * 0.0035;
  const vwapAnchor = candidate.vwap > 0 ? candidate.vwap : candidate.close;
  const pullbackAnchor = Math.max(vwapAnchor, candidate.supportLevel * 1.003, candidate.close - closeBuffer);
  const pullbackLow = roundPrice(Math.max(candidate.close * 0.992, pullbackAnchor - closeBuffer * 0.6));
  const pullbackHigh = roundPrice(Math.min(candidate.close * 1.0015, pullbackAnchor + closeBuffer * 0.45));
  const momentumLow = roundPrice(Math.max(candidate.close * 0.997, vwapAnchor));
  const momentumHigh = roundPrice(Math.min(candidate.close * 1.0025, candidate.dayHigh));
  const afterhoursLow = roundPrice(Math.max(candidate.close * 1.001, candidate.close + closeBuffer * 0.25));
  const afterhoursHigh = roundPrice(Math.min(candidate.close * 1.006, candidate.dayHigh * 1.002));
  const invalidation = roundPrice(Math.min(candidate.supportLevel * 0.992, candidate.close * 0.987));
  const chaseAbove = roundPrice(Math.min(candidate.resistanceLevel * 0.992, candidate.dayHigh * 1.004));

  if (candidate.afterHoursChangePct >= 3 && candidate.postMarketSuitability === "ideal") {
    return {
      mode: "afterhours",
      idealBuyLow: afterhoursLow,
      idealBuyHigh: Math.max(afterhoursLow, afterhoursHigh),
      chaseAbove,
      invalidation,
      summary: `${formatCurrency(afterhoursLow)}-${formatCurrency(
        Math.max(afterhoursLow, afterhoursHigh)
      )} 구간만 허용하고, ${formatCurrency(chaseAbove)} 위 추격은 비효율적입니다.`
    };
  }

  if (candidate.closeStrength30m >= 0.6 && candidate.close > candidate.vwap) {
    return {
      mode: "close-strength",
      idealBuyLow: momentumLow,
      idealBuyHigh: Math.max(momentumLow, momentumHigh),
      chaseAbove,
      invalidation,
      summary: `${formatCurrency(momentumLow)}-${formatCurrency(
        Math.max(momentumLow, momentumHigh)
      )} 종가 강도 유지 구간이 가장 효율적이고, ${formatCurrency(chaseAbove)} 위는 추격 구간입니다.`
    };
  }

  return {
    mode: "pullback",
    idealBuyLow: pullbackLow,
    idealBuyHigh: Math.max(pullbackLow, pullbackHigh),
    chaseAbove,
    invalidation,
    summary: `${formatCurrency(pullbackLow)}-${formatCurrency(
      Math.max(pullbackLow, pullbackHigh)
    )} 눌림 구간을 우선 보고, ${formatCurrency(invalidation)} 아래로 밀리면 시나리오는 무효입니다.`
  };
}

function buildReasonList(
  raw: OvernightRawCandidate,
  positiveNewsCount: number,
  closeToHighPct: number,
  closeAboveVWAPPct: number
) {
  const strongest = strongestCatalyst(raw);
  const items: Array<{ weight: number; text: string }> = [];

  if (raw.afterHoursChangePct >= 1.5) {
    const eventLabel =
      raw.earningsSurpriseScore >= 30 || raw.guidanceScore >= 30 ? "실적/가이던스" : strongest.label;
    items.push({
      weight: 200 + raw.afterHoursChangePct * 4,
      text: `장후 ${eventLabel} 반응으로 애프터마켓 ${signedPercent(raw.afterHoursChangePct)}, 포스트마켓 매수 적합도는 ${suitabilityLabel(
        raw.postMarketSuitability
      )}입니다.`
    });
  }

  if (positiveNewsCount > 0 || strongest.score >= 55) {
    items.push({
      weight: 120 + strongest.score * 0.7,
      text:
        positiveNewsCount > 0
          ? `긍정 뉴스 ${positiveNewsCount}건이 붙었고 핵심 재료는 ${strongest.label}입니다.`
          : `오늘 핵심 재료는 ${strongest.label}이며 재료 점수가 상위권입니다.`
    });
  }

  if (raw.rvol20 >= 1.15 || raw.close30mVolumeRatio >= 1.2 || raw.afterHoursVolumeRatio >= 0.015) {
    items.push({
      weight: 95 + raw.rvol20 * 12 + raw.close30mVolumeRatio * 8,
      text: `RVOL ${raw.rvol20.toFixed(2)}배, 마감 30분 거래량 ${raw.close30mVolumeRatio.toFixed(
        2
      )}배로 종가 직전 수급이 살아 있습니다.`
    });
  }

  if (closeAboveVWAPPct >= 0.15 || closeToHighPct <= 1.8 || raw.closeStrength30m >= 0.4) {
    items.push({
      weight: 90 + Math.max(raw.closeStrength30m, 0) * 12 + Math.max(closeAboveVWAPPct, 0) * 10,
      text: `종가가 VWAP 대비 ${signedPercent(closeAboveVWAPPct)}, 당일 고가 대비 ${closeToHighPct.toFixed(
        1
      )}% 아래에서 마감해 장막판 강도가 유지됐습니다.`
    });
  }

  if (raw.averageDollarVolumeM >= 150 || (raw.marketCapBn >= 20 && raw.spreadBps <= 25)) {
    items.push({
      weight: 88 + Math.min(raw.averageDollarVolumeM / 40, 20),
      text: `평균 거래대금 ${raw.averageDollarVolumeM.toFixed(0)}M달러, 스프레드 ${raw.spreadBps.toFixed(
        0
      )}bp 수준이라 익일 시초 청산 구조가 비교적 깔끔합니다.`
    });
  }

  if (raw.backtest.sampleSize >= 5 && (raw.backtest.gapUpRatePct >= 55 || raw.backtest.averageMaxGainPct >= 1.2)) {
    items.push({
      weight: 78 + raw.backtest.gapUpRatePct * 0.35,
      text: `최근 ${raw.backtest.sampleSize}회 프록시 백테스트에서 갭업 확률 ${raw.backtest.gapUpRatePct.toFixed(
        0
      )}%, 평균 익일 고점 ${signedPercent(raw.backtest.averageMaxGainPct)}로 재현성이 나쁘지 않았습니다.`
    });
  }

  if (raw.sectorMomentumScore >= 68) {
    items.push({
      weight: 72 + raw.sectorMomentumScore * 0.25,
      text: `${raw.sector} 섹터 모멘텀 점수 ${raw.sectorMomentumScore.toFixed(0)}점으로 업종 바람도 우호적입니다.`
    });
  }

  const deduped = items
    .sort((left, right) => right.weight - left.weight)
    .filter((item, index, array) => array.findIndex((candidate) => candidate.text === item.text) === index)
    .slice(0, 3)
    .map((item) => item.text);

  while (deduped.length < 3) {
    deduped.push(`${raw.sector} / ${raw.industry} 흐름 안에서 단기 오버나이트 후보 조건을 충족하고 있습니다.`);
  }

  return deduped;
}

function buildRiskList(
  raw: OvernightRawCandidate,
  earningsRiskDays: number,
  negativeNewsCount: number,
  closeAboveVWAPPct: number
) {
  const items: Array<{ weight: number; text: string }> = [];

  if (raw.dayChangePct < 0 || closeAboveVWAPPct < 0) {
    items.push({
      weight: 120,
      text: `정규장은 ${signedPercent(raw.dayChangePct)}였고 VWAP 대비 ${signedPercent(
        closeAboveVWAPPct
      )}라서, 장후 강세가 내일 본장까지 이어지는지 확인이 필요합니다.`
    });
  }

  if (earningsRiskDays <= 3) {
    items.push({
      weight: 115,
      text: `실적 발표가 ${earningsRiskDays}일 안에 잡혀 있어 방향성보다 변동성 리스크가 더 커질 수 있습니다.`
    });
  }

  if (raw.distanceToResistancePct <= 3.5) {
    items.push({
      weight: 95,
      text: `직전 일봉 저항까지 ${raw.distanceToResistancePct.toFixed(1)}%밖에 남지 않아 시초 급등이 바로 매물대와 부딪힐 수 있습니다.`
    });
  }

  if (negativeNewsCount > 0 || raw.negativeHeadlinePenalty >= 20) {
    items.push({
      weight: 92,
      text: `부정 뉴스 ${negativeNewsCount}건이 남아 있어 갭 상승 후 눌림이 생각보다 빨리 나올 수 있습니다.`
    });
  }

  if (raw.postMarketSuitability !== "ideal" || raw.spreadBps > 30) {
    items.push({
      weight: 82,
      text: `포스트마켓 적합도는 ${suitabilityLabel(raw.postMarketSuitability)}이고 스프레드 ${raw.spreadBps.toFixed(
        0
      )}bp라 체결 품질을 꼭 확인해야 합니다.`
    });
  }

  if (raw.backtest.sampleSize < 5) {
    items.push({
      weight: 70,
      text: "백테스트 표본이 아직 적어 과거 통계는 참고용으로만 봐야 합니다."
    });
  } else {
    items.push({
      weight: 64,
      text: `최근 ${raw.backtest.sampleSize}회 기준 평균 갭은 ${signedPercent(
        raw.backtest.averageGapPct
      )}라 기대치를 과하게 잡기보다 시초 강도 확인이 중요합니다.`
    });
  }

  const deduped = items
    .sort((left, right) => right.weight - left.weight)
    .filter((item, index, array) => array.findIndex((candidate) => candidate.text === item.text) === index)
    .slice(0, 3)
    .map((item) => item.text);

  while (deduped.length < 3) {
    deduped.push("갭 상승이 나와도 시초 5분 안에 수급이 약해지면 종가베팅 효율이 급격히 떨어질 수 있습니다.");
  }

  return deduped;
}

function buildCoreSummary(raw: OvernightRawCandidate, positiveNewsCount: number) {
  const strongest = strongestCatalyst(raw);

  if (raw.afterHoursChangePct >= 2) {
    return `${strongest.label} 반응으로 장후 강세가 붙은 ${raw.sector} 종목입니다. 내일 갭/시초 모멘텀 연결 여부를 보는 자리입니다.`;
  }

  if (raw.rvol20 >= 1.2 && raw.close30mVolumeRatio >= 1.2) {
    return `마감 직전 거래량과 체결 강도가 살아 있는 ${raw.sector} 종목입니다. 2~3일 오버나이트 관점에서 볼 만합니다.`;
  }

  if (positiveNewsCount > 0) {
    return `긍정 뉴스와 업종 모멘텀이 겹친 ${raw.sector} 종목입니다. 재료가 다음 날 갭으로 이어질지 점검하는 자리입니다.`;
  }

  return `${raw.sector} / ${raw.industry} 흐름 안에서 유동성과 단기 수급 조건이 살아 있는 종가베팅 후보입니다.`;
}

export function scoreOvernightCandidate(raw: OvernightRawCandidate, settings: OvernightSettings): OvernightCandidate {
  const earningsRiskDays = raw.daysToEarnings >= 0 ? raw.daysToEarnings : 999;

  const liquidityNormalized =
    logScale(raw.averageVolume, 1_000_000, 120_000_000) * 0.28 +
    logScale(raw.averageDollarVolumeM, 20, 10_000) * 0.34 +
    logScale(raw.marketCapBn, 2, 2_000) * 0.18 +
    invertScale(raw.spreadBps, 8, 60) * 0.2;
  const liquidity = weightedCategoryScore(liquidityNormalized, settings.weights.liquidity, 28, 0.72);

  const closeToHighPct = clamp(raw.dayHigh > 0 ? ((raw.dayHigh - raw.close) / raw.dayHigh) * 100 : 0, 0, 100);
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
  const afterHoursEventBonus =
    (raw.postMarketSuitability === "ideal" ? 6 : raw.postMarketSuitability === "allowed" ? 2 : 0) +
    (raw.afterHoursChangePct >= 8 ? 18 : raw.afterHoursChangePct >= 5 ? 12 : raw.afterHoursChangePct >= 2 ? 6 : 0) +
    ((raw.earningsSurpriseScore >= 30 || raw.guidanceScore >= 30) && raw.afterHoursChangePct > 0 ? 10 : 0);
  const catalystNormalized =
    raw.earningsSurpriseScore * 0.18 +
    raw.guidanceScore * 0.14 +
    raw.contractScore * 0.12 +
    raw.policyScore * 0.08 +
    raw.analystScore * 0.14 +
    raw.themeScore * 0.16 +
    raw.sectorMomentumScore * 0.18 * settings.sectorWeightMultiplier +
    screenerMomentumBonus +
    afterHoursEventBonus -
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
    scale(raw.afterHoursChangePct, -1, 8) * 0.16 +
    scale(raw.afterHoursSpreadStable, 35, 95) * 0.12 +
    scale(raw.distanceToResistancePct, 1, 9) * 0.14 +
    scale(Math.min(earningsRiskDays, 14), 3, 14) * 0.12 +
    backtestSignalScore * 0.1 +
    (raw.postMarketSuitability === "ideal" && raw.afterHoursChangePct > 3 ? 10 : 0);
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
  const entryGuide = buildEntryGuide(raw);

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
    reasons: buildReasonList(raw, positiveNewsCount, closeToHighPct, closeAboveVWAPPct),
    risks: buildRiskList(raw, earningsRiskDays, negativeNewsCount, closeAboveVWAPPct),
    coreSummary: buildCoreSummary(raw, positiveNewsCount),
    scenario: buildScenario(raw),
    entryGuide,
    entryIdea: `권장 매수 구간은 ${formatCurrency(entryGuide.idealBuyLow)}-${formatCurrency(
      entryGuide.idealBuyHigh
    )}입니다. ${formatCurrency(entryGuide.chaseAbove)} 위 추격은 피하고 ${formatCurrency(entryGuide.invalidation)} 아래 이탈 시 무효로 봅니다.`,
    exitIdea: `익일 시초 강세가 나오면 ${formatCurrency(raw.resistanceLevel)} 부근 1차 청산, 시초 5분 VWAP 이탈 시 빠르게 정리하는 방식이 좋습니다.`,
    closeTapeNote: `종가-고가 거리 ${closeToHighPct.toFixed(1)}%, 마감 30분 강도 ${signedPercent(
      raw.closeStrength30m
    )}, 마감 구간 거래량 ${raw.close30mVolumeRatio.toFixed(2)}배입니다.`,
    overnightRiskNote:
      earningsRiskDays <= 30
        ? `애프터마켓 ${signedPercent(raw.afterHoursChangePct)}, 다음 실적까지 ${earningsRiskDays}일, 직전 저항까지 ${raw.distanceToResistancePct.toFixed(
            1
          )}%입니다.`
        : `애프터마켓 ${signedPercent(raw.afterHoursChangePct)}, 직전 저항까지 ${raw.distanceToResistancePct.toFixed(
            1
          )}%이며 단기 실적 일정 리스크는 크지 않습니다.`,
    news: raw.news.map((item) => ({
      ...item,
      summary:
        item.summary && item.summary.trim().length > 0
          ? item.summary
          : `${catalystLabel(item.catalyst)} 재료로 분류한 기사입니다.`
    })),
    backtest: raw.backtest
  };
}
