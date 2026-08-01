import { notFound } from "next/navigation";
import { AdminHeader } from "@/features/tenant-admin/AdminHeader";
import { getAuditLogs, DATA_SCOPES } from "@/features/tenant-admin/data";
import { getPeople } from "@/features/tenant-admin/identity.server";
import { UserDetailClient } from "./UserDetailClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { users } = await getPeople();
  const u = users.find((x) => x.id === id);
  return { title: `${u?.name ?? "Người dùng"} · Quản trị · XHub` };
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { users } = await getPeople();
  const user = users.find((x) => x.id === id);
  if (!user) notFound();

  // Audit trail + bound data-scopes have no live endpoint yet → demo data.
  const audit = getAuditLogs().filter((e) => e.actorId === id).slice().sort((a, b) => (a.at < b.at ? 1 : -1));
  const scopes = DATA_SCOPES.filter((s) => user.roleCodes.some((rc) => rc.toUpperCase().includes(s.boundRole)) || true).slice(0, 3);

  return (
    <div className="space-y-4">
      <AdminHeader title={user.name} subtitle={`${user.title} · ${user.department}`} back={{ href: "/admin/users", label: "Người dùng" }}
        chip={{ label: user.status === "active" ? "Hoạt động" : user.status, tone: user.status === "active" ? "success" : "neutral" }} />
      <UserDetailClient user={user} audit={audit} scopes={scopes} />
    </div>
  );
}
