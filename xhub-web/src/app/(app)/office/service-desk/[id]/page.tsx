import { notFound } from "next/navigation";
import { getTicket } from "@/xoffice/lib/tickets-data";
import { TicketDetailClient } from "@/xoffice/tickets/TicketDetailClient";

export const metadata = { title: "Chi tiết yêu cầu hỗ trợ · X.Office" };

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { detail, ctx } = await getTicket(id);
  if (!detail) notFound();
  return <TicketDetailClient detail={detail} currentUserId={ctx.userId} />;
}
