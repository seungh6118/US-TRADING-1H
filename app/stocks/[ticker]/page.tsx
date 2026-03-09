import { notFound } from "next/navigation";
import { StockDetailView } from "@/components/stock-detail-view";
import { getStockDetail } from "@/services/research-service";

export const dynamic = "force-dynamic";

export default async function StockDetailPage({ params }: { params: { ticker: string } }) {
  const data = await getStockDetail(params.ticker.toUpperCase());
  if (!data) {
    notFound();
  }

  return <StockDetailView data={data} />;
}
