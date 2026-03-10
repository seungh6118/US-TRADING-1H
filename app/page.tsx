import { OvernightDashboardClient } from "@/components/overnight-dashboard-client";
import { getOvernightDashboardData } from "@/services/overnight-research-service";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const data = getOvernightDashboardData();
  return <OvernightDashboardClient initialData={data} />;
}
