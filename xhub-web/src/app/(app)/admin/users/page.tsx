import { AdminHeader } from "@/features/tenant-admin/AdminHeader";
import { getPeople } from "@/features/tenant-admin/identity.server";
import { UsersClient } from "./UsersClient";

export const metadata = { title: "Người dùng · Quản trị · XHub" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  // Live people composed with positions/groups/role-bindings; falls back to seed.
  const { source, users } = await getPeople();
  return (
    <div className="space-y-4">
      <AdminHeader
        title="Người dùng & thành viên"
        subtitle="Quản lý membership của tenant — mời, khoá, kích hoạt lại và phân vai trò. Credential/MFA do IdP ngoài quản lý."
        chip={source === "live" ? { label: "Dữ liệu trực tiếp (/api/identity)", tone: "success" } : { label: "Backend chưa sẵn — demo", tone: "warning" }}
      />
      <UsersClient users={users} />
    </div>
  );
}
