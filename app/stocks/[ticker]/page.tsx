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

    return (
      <LiveRequiredPanel
        title="종목 상세 데이터를 불러오는 중 오류가 발생했습니다."
        detail={error instanceof Error ? error.message : "서버에서 예상하지 못한 오류가 발생했습니다."}
      />
    );
  }
}
