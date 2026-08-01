import { notFound } from "next/navigation";
import { getWorkItem } from "@/xoffice/lib/work-items-data";
import { WorkDetailClient } from "@/xoffice/work/WorkDetailClient";

export const metadata = { title: "Chi tiết công việc · XHub" };
export const dynamic = "force-dynamic";

// WK-03 — NativeWorkItem detail. The server returns FULL or SUMMARY per actor
// (owner requirement #1); the client renders accordingly.
export default async function WorkItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { detail } = await getWorkItem(id);
  if (!detail?.item) notFound();
  return <WorkDetailClient detail={detail} />;
}
