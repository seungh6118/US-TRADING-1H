import { notFound } from "next/navigation";
import { OvernightDetailView } from "@/components/overnight-detail-view";
import { defaultOvernightSettings } from "@/lib/overnight-defaults";
import { getOvernightCandidateDetail } from "@/services/overnight-research-service";

export const dynamic = "force-dynamic";

export default async function StockDetailPage({ params }: { params: { ticker: string } }) {
  const candidate = await getOvernightCandidateDetail(params.ticker, defaultOvernightSettings);

  if (!candidate) {
    notFound();
  }

  return <OvernightDetailView candidate={candidate} settings={defaultOvernightSettings} />;
}
