import { DashboardClient } from "@/components/dashboard-client";
import { LiveRequiredPanel } from "@/components/live-required-panel";
import { isLiveDataUnavailableError } from "@/lib/errors";
import { getDashboardData } from "@/services/research-service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  try {
    const data = await getDashboardData();
    return <DashboardClient initialData={data} />;
  } catch (error) {
    if (isLiveDataUnavailableError(error)) {
      return <LiveRequiredPanel title="실시간 데이터 연결이 아직 준비되지 않았습니다." detail={error.message} />;
    }

    throw error;
  }
}
