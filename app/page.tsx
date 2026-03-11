import { OvernightDashboardClient } from "@/components/overnight-dashboard-client";
import { getOvernightDashboardData } from "@/services/overnight-research-service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getOvernightDashboardData();
  return <OvernightDashboardClient initialData={data} />;
}
