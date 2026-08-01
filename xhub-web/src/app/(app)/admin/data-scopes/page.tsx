import { AdminHeader } from "@/features/tenant-admin/AdminHeader";
import { DATA_SCOPES, getAdminUsers } from "@/features/tenant-admin/data";
import { getPeople } from "@/features/tenant-admin/identity.server";
import { DataScopesClient } from "./DataScopesClient";

export const metadata = { title: "Phạm vi dữ liệu · Quản trị · XHub" };
export const dynamic = "force-dynamic";

export default async function AdminDataScopesPage() {
  // User list is live (Identity Core); "test as user" runs the live RBAC/ABAC
  // check via /api/admin/permission-check. The scope CATALOG stays demo — no GET
  // endpoint lists DataScope definitions yet. Falls back to seed users.
  const { source, users: live } = await getPeople();
  const src = source === "live" ? live : getAdminUsers();
  const users = src.map((u) => ({ id: u.id, name: u.name, department: u.department, roleNames: u.roleNames }));
  return (
    <div className="space-y-4">
      <AdminHeader title="Phạm vi dữ liệu (ABAC)" subtitle="Định nghĩa phạm vi truy cập theo chiều dữ liệu, xem quyền hiệu lực và kiểm tra như một người dùng cụ thể."
        chip={source === "live" ? { label: "Kiểm tra trực tiếp (/api/identity) · danh mục demo", tone: "success" } : { label: "Backend chưa sẵn — demo", tone: "warning" }} />
      <DataScopesClient scopes={DATA_SCOPES} users={users} live={source === "live"} />
    </div>
  );
}
