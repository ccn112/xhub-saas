import { getMonitorSnapshot } from "@/xoffice/lib/monitor-data";
import { MonitorClient } from "@/xoffice/monitor/MonitorClient";

export const metadata = { title: "Giám sát vận hành · X.Office" };

// Always render fresh runtime state (in-memory backend changes per action).
export const dynamic = "force-dynamic";

export default async function WorkflowMonitorPage() {
  const snapshot = await getMonitorSnapshot();
  return <MonitorClient snapshot={snapshot} identity={snapshot.identity} />;
}
