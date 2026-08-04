import { TestConsole } from "@/components/docs/TestConsole";
import { XOFFICE_TEST_GROUPS } from "@/components/docs/test-data";

export const metadata = { title: "Kiểm thử X.Office · X.Office · XHub" };

// Bộ tài liệu kiểm thử RIÊNG cho X.Office (Phase 1.5 Stage D, 2026-08-04) —
// chỉ các nhóm do process xoffice (:4001) phục vụ: X.Office, Tài liệu, Công
// việc, Quản trị (Management OS), IOC — Bản sao số, Nhân sự & Công, Đa tenant.
// Không hiện bot-test (thuộc bộ tài liệu chung /docs/test).
export default function XofficeTestPage() {
  return <TestConsole groups={[...XOFFICE_TEST_GROUPS]} showBotTests={false} />;
}
