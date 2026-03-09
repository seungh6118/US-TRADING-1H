import { DashboardClient } from "@/components/dashboard-client";
import { getDashboardData } from "@/services/research-service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getDashboardData();
  return <DashboardClient initialData={data} />;
}
