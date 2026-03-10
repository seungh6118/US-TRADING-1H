import nextDynamic from "next/dynamic";
import { DashboardLoadingShell } from "@/components/dashboard-loading-shell";

const DashboardBootClient = nextDynamic(
  () => import("@/components/dashboard-boot-client").then((module) => module.DashboardBootClient),
  {
    ssr: false,
    loading: () => <DashboardLoadingShell />
  }
);

export const dynamic = "force-dynamic";

export default function HomePage() {
  return <DashboardBootClient />;
}
