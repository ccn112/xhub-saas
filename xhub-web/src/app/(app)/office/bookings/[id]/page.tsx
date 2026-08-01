import { notFound } from "next/navigation";
import { getBooking } from "@/xoffice/lib/bookings-data";
import { BookingDetailClient } from "@/xoffice/bookings/BookingDetailClient";

export const metadata = { title: "Chi tiết đặt chỗ · X.Office" };

export const dynamic = "force-dynamic";

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { detail, ctx } = await getBooking(id);
  if (!detail) notFound();
  return <BookingDetailClient detail={detail} currentUserId={ctx.userId} />;
}
