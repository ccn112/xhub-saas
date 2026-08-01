// Public /forgot — request a password reset. Internal `.local` accounts are not
// emailed; the reset link is surfaced on screen for the dev/pilot environment.
import { ForgotForm } from "./ForgotForm";
import { AuthShell } from "../_AuthShell";

export const dynamic = "force-dynamic";

export default function ForgotPage() {
  return (
    <AuthShell title="Quên mật khẩu" subtitle="Nhập email hoặc userId — chúng tôi sẽ tạo liên kết đặt lại mật khẩu.">
      <ForgotForm />
    </AuthShell>
  );
}
