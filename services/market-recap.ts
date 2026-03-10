import { MarketDailyRecap, StockSnapshot } from "@/lib/types";
import { fetchYahooHistory } from "@/providers/live/yahoo-chart";

type DailyMove = {
  symbol: string;
  label: string;
  sessionDate: string;
  change1dPct: number;
};

function formatSignedPercent(value: number) {
  const rounded = Number(value.toFixed(1));
  return `${rounded >= 0 ? "+" : ""}${rounded.toFixed(1)}%`;
}

function latestOneDayChange(history: Awaited<ReturnType<typeof fetchYahooHistory>>) {
  const last = history.at(-1);
  const prev = history.at(-2);
  if (!last || !prev || prev.close === 0) {
    return null;
  }

  return {
    sessionDate: last.date.slice(0, 10),
    change1dPct: ((last.close - prev.close) / prev.close) * 100
  };
}

async function fetchMove(symbol: string, label: string): Promise<DailyMove | null> {
  try {
    const history = await fetchYahooHistory(symbol, "10d", "1d");
    const latest = latestOneDayChange(history);
    if (!latest) {
      return null;
    }

    return {
      symbol,
      label,
      sessionDate: latest.sessionDate,
      change1dPct: latest.change1dPct
    };
  } catch {
    return null;
  }
}

function averageMove(moves: Array<DailyMove | null>) {
  const valid = moves.filter((item): item is DailyMove => item !== null);
  if (valid.length === 0) {
    return null;
  }

  return valid.reduce((sum, item) => sum + item.change1dPct, 0) / valid.length;
}

function buildIndexFlow(indices: DailyMove[]) {
  return indices.map((item) => {
    const tone =
      item.symbol === "^IXIC"
        ? "나스닥"
        : item.symbol === "^GSPC"
          ? "S&P500"
          : item.symbol === "^DJI"
            ? "다우"
            : item.label;

    return `${tone} ${formatSignedPercent(item.change1dPct)}${item.change1dPct > 0.9 ? "로 강세" : item.change1dPct > 0 ? "로 반등" : "로 약세"}`;
  });
}

export function buildMockMarketRecap(): MarketDailyRecap {
  return {
    sessionDate: new Date().toISOString().slice(0, 10),
    indexFlow: ["나스닥 강세, S&P500 반등, 다우는 상대적으로 둔한 흐름"],
    strongAreas: [
      "반도체 / AI 강세",
      "전력 인프라 / 데이터센터 전력 공급 강세",
      "Bloom Energy는 전통 에너지보다 AI 전력 인프라 흐름으로 보는 편이 맞습니다."
    ],
    weakAreas: ["금융 / 은행 약세", "주택건설 약세", "전통 방산은 상대적으로 탄력이 약합니다."],
    standoutMovers: ["Bloom Energy(BE) 강세", "NVIDIA, Broadcom, Vertiv 강세"],
    interpretation:
      "반도체와 AI 관련주가 강했고, 그중에서도 AI 데이터센터 전력 수요 기대를 받는 전력 인프라와 연료전지 계열 종목이 부각됐습니다. Bloom Energy는 이 흐름의 대표 강세주로 따로 봐야 합니다. 반면 금융, 은행, 주택건설 쪽은 상대적으로 약했습니다."
  };
}

export async function buildLiveMarketRecap(candidates: StockSnapshot[]): Promise<MarketDailyRecap> {
  const [nasdaq, spx, dow, soxx, xlf, kbe, xhb, xle, be, vrt, gev, nvda, avgo, rtx, lmt, noc] = await Promise.all([
    fetchMove("^IXIC", "Nasdaq"),
    fetchMove("^GSPC", "S&P 500"),
    fetchMove("^DJI", "Dow"),
    fetchMove("SOXX", "Semiconductors"),
    fetchMove("XLF", "Financials"),
    fetchMove("KBE", "Banks"),
    fetchMove("XHB", "Homebuilders"),
    fetchMove("XLE", "Energy"),
    fetchMove("BE", "Bloom Energy"),
    fetchMove("VRT", "Vertiv"),
    fetchMove("GEV", "GE Vernova"),
    fetchMove("NVDA", "NVIDIA"),
    fetchMove("AVGO", "Broadcom"),
    fetchMove("RTX", "RTX"),
    fetchMove("LMT", "Lockheed Martin"),
    fetchMove("NOC", "Northrop Grumman")
  ]);

  const sessionDate = [nasdaq, spx, dow].find((item) => item !== null)?.sessionDate ?? new Date().toISOString().slice(0, 10);

  const powerBasket = averageMove([be, vrt, gev]);
  const defenseBasket = averageMove([rtx, lmt, noc]);
  const standoutUniverse = [
    be,
    vrt,
    gev,
    nvda,
    avgo,
    rtx,
    lmt,
    noc,
    ...candidates
      .filter((item) => !["BE", "VRT", "GEV", "NVDA", "AVGO", "RTX", "LMT", "NOC"].includes(item.profile.ticker))
      .slice(0, 8)
      .map((item) => ({
        symbol: item.profile.ticker,
        label: item.profile.companyName,
        change1dPct: item.quote.change1dPct
      }))
  ]
    .filter((item): item is DailyMove => item !== null);

  const strongAreas = [
    soxx ? `반도체 / AI 하드웨어 강세: SOXX ${formatSignedPercent(soxx.change1dPct)}` : null,
    powerBasket !== null
      ? `AI 전력 인프라 강세: BE ${be ? formatSignedPercent(be.change1dPct) : "n/a"}, VRT ${vrt ? formatSignedPercent(vrt.change1dPct) : "n/a"}, GEV ${gev ? formatSignedPercent(gev.change1dPct) : "n/a"}`
      : null
  ].filter((item): item is string => Boolean(item));

  const weakAreas = [
    xlf && kbe ? `금융 / 은행 약세: XLF ${formatSignedPercent(xlf.change1dPct)}, KBE ${formatSignedPercent(kbe.change1dPct)}` : null,
    xhb ? `주택건설 약세: XHB ${formatSignedPercent(xhb.change1dPct)}` : null,
    defenseBasket !== null && defenseBasket < 0
      ? `전통 방산은 상대적으로 약세: RTX ${rtx ? formatSignedPercent(rtx.change1dPct) : "n/a"}, LMT ${lmt ? formatSignedPercent(lmt.change1dPct) : "n/a"}, NOC ${noc ? formatSignedPercent(noc.change1dPct) : "n/a"}`
      : null,
    xle && be && xle.change1dPct <= 0 && be.change1dPct > 0
      ? `전통 에너지(XLE ${formatSignedPercent(xle.change1dPct)})와 달리 Bloom Energy는 같은 에너지 묶음으로 보기 어렵습니다.`
      : null
  ].filter((item): item is string => Boolean(item));

  const topGainers = [...standoutUniverse]
    .sort((left, right) => right.change1dPct - left.change1dPct)
    .slice(0, 3)
    .map((item) => `강세: ${item.label}(${item.symbol}) ${formatSignedPercent(item.change1dPct)}`);
  const topLaggards = [...standoutUniverse]
    .sort((left, right) => left.change1dPct - right.change1dPct)
    .slice(0, 2)
    .map((item) => `약세: ${item.label}(${item.symbol}) ${formatSignedPercent(item.change1dPct)}`);
  const standoutMovers = [...topGainers, ...topLaggards];

  const interpretationParts = [
    "반도체와 AI 관련주가 강했고",
    powerBasket !== null && powerBasket > 0
      ? "그중에서도 AI 데이터센터 전력 수요 기대를 받는 전력 인프라와 연료전지 계열 종목이 부각됐습니다"
      : "전력 인프라 쪽도 일부 종목 중심으로 강세가 나타났습니다",
    be && be.change1dPct > 0
      ? "Bloom Energy는 이 흐름의 대표 강세주 중 하나로, 유가 수혜 에너지주보다 AI 전력 인프라 / 전력 공급 솔루션 수혜주로 분류하는 편이 맞습니다"
      : null,
    xlf && kbe && xhb
      ? `반면 금융, 은행, 주택건설은 각각 ${formatSignedPercent(xlf.change1dPct)}, ${formatSignedPercent(kbe.change1dPct)}, ${formatSignedPercent(xhb.change1dPct)}로 상대적으로 약했습니다`
      : "반면 금융과 주택건설은 상대적으로 약했습니다"
  ].filter((item): item is string => Boolean(item));

  return {
    sessionDate,
    indexFlow: buildIndexFlow([nasdaq, spx, dow].filter((item): item is DailyMove => item !== null)),
    strongAreas,
    weakAreas,
    standoutMovers,
    interpretation: interpretationParts.join(" ") + "."
  };
}
