import { AdminHeader } from "@/features/tenant-admin/AdminHeader";
import { getDelegations } from "@/features/tenant-admin/identity.server";
import { DelegationsClient } from "./DelegationsClient";

export const metadata = { title: "Uỷ quyền · Quản trị · XHub" };
export const dynamic = "force-dynamic";

export default async function AdminDelegationsPage() {
  const { source, delegations } = await getDelegations();
  return (
    <div className="space-y-4">
      <AdminHeader title="Uỷ quyền & người thay" subtitle="Uỷ quyền có thời hạn kèm phạm vi. Guardrail: không tự uỷ quyền, không vòng lặp, không vượt quyền nguồn."
        chip={source === "live"
          ? { label: "Uỷ quyền trực tiếp (/api/identity)", tone: "success" }
          : { label: "Backend chưa sẵn — demo", tone: "warning" }} />
      <DelegationsClient delegations={delegations} />
    </div>
  );
}
