import { notFound } from "next/navigation";
import { getDirective } from "@/xoffice/lib/directives-data";
import { DirectiveDetailClient } from "@/xoffice/directives/DirectiveDetailClient";

export const metadata = { title: "Chi tiết chỉ đạo · X.Office" };

export const dynamic = "force-dynamic";

export default async function DirectiveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { detail } = await getDirective(id);
  if (!detail) notFound();
  return <DirectiveDetailClient detail={detail} />;
}
