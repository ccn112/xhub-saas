import { TestConsole } from "@/components/docs/TestConsole";
import { PLATFORM_TEST_GROUPS } from "@/components/docs/test-data";

export const metadata = { title: "Kiểm thử · Tài liệu · XHub" };

// Trung tâm tài liệu chung (Phase 1.5 Stage D, 2026-08-04): kiểm thử cho X.Office
// giờ có bộ riêng ở /office/docs/test — trang này còn lại phần Platform + hạ
// tầng dùng chung (X.Space, đăng nhập/điều hướng, dev-ops tách process...), và
// sẽ là nơi tập trung tài liệu kiểm thử/phát triển/backlog/change-request cho
// toàn bộ phần mềm còn lại ngoài X.Office.
export default function TestPage() {
  return <TestConsole groups={[...PLATFORM_TEST_GROUPS]} />;
}
