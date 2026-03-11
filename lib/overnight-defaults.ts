import { OvernightSettings } from "@/lib/overnight-types";

export const defaultOvernightSettings: OvernightSettings = {
  minPrice: 10,
  minAverageVolume: 1_000_000,
  minAverageDollarVolumeM: 20,
  minMarketCapBn: 2,
  onlyAGrade: false,
  excludeUpcomingEarnings: true,
  allowPostMarket: true,
  autoRefreshSeconds: 60,
  weights: {
    liquidity: 20,
    intradayStrength: 25,
    flowVolume: 20,
    catalystMomentum: 25,
    nextDayRealizability: 10
  },
  newsWeightMultiplier: 1,
  sectorWeightMultiplier: 1
};

export function normalizeOvernightSettings(input?: Partial<OvernightSettings>): OvernightSettings {
  if (!input) {
    return defaultOvernightSettings;
  }

  return {
    ...defaultOvernightSettings,
    ...input,
    weights: {
      ...defaultOvernightSettings.weights,
      ...input.weights
    }
  };
}
