import { notFound } from "next/navigation";
import { LiveRequiredPanel } from "@/components/live-required-panel";
import { StockDetailView } from "@/components/stock-detail-view";
import { isLiveDataUnavailableError } from "@/lib/errors";
import { getStockDetail } from "@/services/research-service";

export const dynamic = "force-dynamic";

export default async function StockDetailPage({ params }: { params: { ticker: string } }) {
  try {
    const data = await getStockDetail(params.ticker.toUpperCase());
    if (!data) {
      notFound();
    }

    return <StockDetailView data={data} />;
  } catch (error) {
    if (isLiveDataUnavailableError(error)) {
      return <LiveRequiredPanel title="종목 상세를 열기 전에 실시간 데이터 연결이 필요합니다." detail={error.message} />;
    }

    throw error;
  }
}
