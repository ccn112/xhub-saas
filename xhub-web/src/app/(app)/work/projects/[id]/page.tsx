import { notFound } from "next/navigation";
import { getProject } from "@/xoffice/lib/work-projects-data";
import { ProjectDetailClient } from "@/xoffice/work/ProjectDetailClient";

export const metadata = { title: "Chi tiết dự án · XHub" };
export const dynamic = "force-dynamic";

// Execution Project detail (W2). The API decides FULL vs SUMMARY access per actor
// (CoordinationShare — owner requirement #1); the client renders only what the
// server returned. A NONE-access viewer gets a 404 from the API → notFound().
export default async function WorkProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { detail } = await getProject(id);
  if (!detail || !detail.project) notFound();
  return <ProjectDetailClient detail={detail} />;
}
