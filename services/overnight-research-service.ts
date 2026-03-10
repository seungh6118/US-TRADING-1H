import { defaultOvernightSettings, normalizeOvernightSettings } from "@/lib/overnight-defaults";
import { OvernightCandidate, OvernightDashboardData, OvernightSettings } from "@/lib/overnight-types";
import { mockOvernightMarketBrief, mockOvernightUniverse } from "@/providers/mock/overnight-mock";
import { scoreOvernightCandidate } from "@/scoring/overnight-engine";

function passesFilters(candidate: OvernightCandidate, settings: OvernightSettings) {
  if (candidate.price < settings.minPrice) {
    return false;
  }
  if (candidate.averageVolume < settings.minAverageVolume) {
    return false;
  }
  if (candidate.averageDollarVolumeM < settings.minAverageDollarVolumeM) {
    return false;
  }
  if (candidate.marketCapBn < settings.minMarketCapBn) {
    return false;
  }
  if (settings.excludeUpcomingEarnings && candidate.daysToEarnings <= 3) {
    return false;
  }
  if (!settings.allowPostMarket && candidate.postMarketSuitability === "avoid") {
    return false;
  }
  if (settings.onlyAGrade && candidate.score.grade !== "A") {
    return false;
  }
  return true;
}

function buildAlerts(candidates: OvernightCandidate[]) {
  const aNames = candidates.filter((candidate) => candidate.score.grade === "A").slice(0, 3);
  const postMarketNames = candidates.filter((candidate) => candidate.postMarketSuitability === "ideal").slice(0, 2);

  return [
    {
      id: "grade-a",
      title: "A급 후보 감시",
      detail: aNames.length > 0 ? `${aNames.map((item) => item.ticker).join(", ")} 가 A급 후보로 집계됐습니다.` : "아직 A급 후보가 많지 않습니다."
    },
    {
      id: "close-minus-15",
      title: "장마감 15분 전 TOP 5",
      detail: candidates.slice(0, 5).map((item) => item.ticker).join(", ")
    },
    {
      id: "post-market",
      title: "포스트마켓 적합",
      detail: postMarketNames.length > 0 ? `${postMarketNames.map((item) => item.ticker).join(", ")} 는 포스트마켓 접근이 상대적으로 수월합니다.` : "오늘은 포스트마켓 우선 후보가 뚜렷하지 않습니다."
    }
  ];
}

export function getOvernightDashboardData(settingsInput?: Partial<OvernightSettings>): OvernightDashboardData {
  const settings = normalizeOvernightSettings(settingsInput);
  const candidates = mockOvernightUniverse
    .map((item) => scoreOvernightCandidate(item, settings))
    .filter((candidate) => passesFilters(candidate, settings))
    .sort((left, right) => right.score.total - left.score.total);

  return {
    generatedAt: new Date().toISOString(),
    marketBrief: mockOvernightMarketBrief,
    settings,
    candidates,
    topCandidates: candidates.slice(0, 10),
    alerts: buildAlerts(candidates)
  };
}

export function getOvernightCandidateDetail(ticker: string, settingsInput?: Partial<OvernightSettings>) {
  const data = getOvernightDashboardData(settingsInput ?? defaultOvernightSettings);
  return data.candidates.find((candidate) => candidate.ticker === ticker.toUpperCase()) ?? null;
}
