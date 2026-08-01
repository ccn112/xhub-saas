// Public /activate?token=… — set-password activation for an invited account.
import { ActivateForm } from "./ActivateForm";
import { AuthShell } from "../_AuthShell";

export const dynamic = "force-dynamic";

export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthShell title="Kích hoạt tài khoản" subtitle="Đặt mật khẩu cho tài khoản của bạn để hoàn tất lời mời.">
      <ActivateForm token={token ?? ""} />
    </AuthShell>
  );
}
