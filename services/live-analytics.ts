import { SectorPerformance, StockSnapshot, ThemeSnapshot } from "@/lib/types";
import { clamp } from "@/lib/utils";

function weightedAverage(values: Array<{ value: number; weight: number }>) {
  const totalWeight = values.reduce((sum, item) => sum + Math.max(item.weight, 1), 0);
  if (totalWeight === 0) {
    return 0;
  }

  return values.reduce((sum, item) => sum + item.value * Math.max(item.weight, 1), 0) / totalWeight;
}

function scoreFromMomentum(change5dPct: number, change20dPct: number, change60dPct: number, excess20dPct: number) {
  return clamp(50 + change5dPct * 1.2 + change20dPct * 1.5 + change60dPct * 0.4 + excess20dPct * 1.5);
}

export function buildLiveSectorPerformance(stocks: StockSnapshot[]): SectorPerformance[] {
  const benchmark20d = weightedAverage(
    stocks.map((stock) => ({
      value: stock.quote.change20dPct,
      weight: stock.fundamentals.marketCapBn
    }))
  );

  const grouped = new Map<string, StockSnapshot[]>();
  stocks.forEach((stock) => {
    const list = grouped.get(stock.profile.sector) ?? [];
    list.push(stock);
    grouped.set(stock.profile.sector, list);
  });

  return Array.from(grouped.entries())
    .map(([sector, members]) => {
      const performance5dPct = weightedAverage(members.map((stock) => ({ value: stock.quote.change5dPct, weight: stock.fundamentals.marketCapBn })));
      const performance20dPct = weightedAverage(members.map((stock) => ({ value: stock.quote.change20dPct, weight: stock.fundamentals.marketCapBn })));
      const performance60dPct = weightedAverage(members.map((stock) => ({ value: stock.quote.change60dPct, weight: stock.fundamentals.marketCapBn })));
      const excess20dPct = performance20dPct - benchmark20d;
      const relativeStrength = Number((1 + excess20dPct / 100).toFixed(2));
      const topNames = [...members]
        .sort((left, right) => right.fundamentals.marketCapBn - left.fundamentals.marketCapBn)
        .slice(0, 3)
        .map((stock) => stock.profile.ticker.toUpperCase());

      return {
        sector,
        etf: topNames.join(", "),
        performance5dPct: Number(performance5dPct.toFixed(2)),
        performance20dPct: Number(performance20dPct.toFixed(2)),
        performance60dPct: Number(performance60dPct.toFixed(2)),
        relativeStrength,
        score: Number(scoreFromMomentum(performance5dPct, performance20dPct, performance60dPct, excess20dPct).toFixed(1)),
        drivers: topNames
      } satisfies SectorPerformance;
    })
    .sort((left, right) => right.score - left.score);
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

export function buildLiveThemeSnapshots(stocks: StockSnapshot[]): ThemeSnapshot[] {
  const grouped = new Map<string, StockSnapshot[]>();

  stocks.forEach((stock) => {
    stock.profile.themes.forEach((theme) => {
      const list = grouped.get(theme) ?? [];
      list.push(stock);
      grouped.set(theme, list);
    });
  });

  return Array.from(grouped.entries())
    .map(([name, members]) => {
      const linkedTickers = unique(members.map((stock) => stock.profile.ticker)).slice(0, 8);
      const allNews = members.flatMap((stock) => stock.recentNews);
      const newsMentions = allNews.length;
      const sentimentRaw = allNews.length === 0 ? 0 : allNews.reduce((sum, item) => sum + item.sentimentScore, 0) / allNews.length;
      const sentimentScore = clamp(50 + sentimentRaw * 50);
      const avg5d = weightedAverage(members.map((stock) => ({ value: stock.quote.change5dPct, weight: stock.fundamentals.marketCapBn })));
      const avg20d = weightedAverage(members.map((stock) => ({ value: stock.quote.change20dPct, weight: stock.fundamentals.marketCapBn })));
      const priceMomentumScore = clamp(50 + avg5d * 2 + avg20d * 1.5);
      const mentionScore = clamp(newsMentions * 6, 0, 100);
      const score = clamp(priceMomentumScore * 0.45 + sentimentScore * 0.3 + mentionScore * 0.25);

      let summary = `${name} 테마는 현재 종목별 선별이 중요합니다.`;
      if (score >= 75) {
        summary = `${name} 테마는 뉴스와 가격 반응이 함께 강해 상위 감시 대상으로 볼 만합니다.`;
      } else if (score >= 60) {
        summary = `${name} 테마는 관심을 둘 만하지만 종목별 차트 차이가 커서 선별 접근이 필요합니다.`;
      } else if (score < 45) {
        summary = `${name} 테마는 서사 대비 가격 확인이 부족해 우선순위가 낮습니다.`;
      }

      return {
        name,
        newsMentions,
        sentimentScore: Number(sentimentScore.toFixed(1)),
        priceMomentumScore: Number(priceMomentumScore.toFixed(1)),
        score: Number(score.toFixed(1)),
        linkedTickers,
        summary
      } satisfies ThemeSnapshot;
    })
    .sort((left, right) => right.score - left.score);
}
