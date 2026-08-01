import { notFound } from "next/navigation";
import { getAnnouncement } from "@/xoffice/lib/announcements-data";
import { AnnouncementDetailClient } from "@/xoffice/announcements/AnnouncementDetailClient";

export const metadata = { title: "Chi tiết thông báo · X.Office" };

export const dynamic = "force-dynamic";

export default async function AnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { detail, ctx } = await getAnnouncement(id);
  if (!detail) notFound();
  return <AnnouncementDetailClient detail={detail} currentUserId={ctx.userId} />;
}
