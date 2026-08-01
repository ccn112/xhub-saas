import { notFound } from "next/navigation";
import { getRequest } from "@/xoffice/lib/requests-data";
import { RequestDetailClient } from "@/xoffice/requests/RequestDetailClient";

export const metadata = { title: "Chi tiết yêu cầu · X.Office" };

export const dynamic = "force-dynamic";

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { detail } = await getRequest(id);
  if (!detail) notFound();
  return <RequestDetailClient detail={detail} />;
}
