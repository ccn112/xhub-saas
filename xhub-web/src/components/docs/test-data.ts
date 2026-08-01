// Static test data for the interactive Kiểm thử console.

export interface BotTestRow {
  cmd: string;
  expected: string;
  note?: string;
}

// Latest automated run: 2026-07-30 — ALL PASS (27/27).
// Danh sách bám theo `xhub-api/package.json` (mọi cổng `test:*` hiện có) + 2 cổng tsc + scan:secrets.
export const BOT_TEST_RESULTS: BotTestRow[] = [
  { cmd: "api tsc (npx tsc --noEmit)", expected: "0 lỗi — API biên dịch sạch (NestJS/Prisma)" },
  { cmd: "web tsc (npx tsc --noEmit)", expected: "0 lỗi src/** — web biên dịch sạch (Next 16)" },
  { cmd: "test:rls", expected: "RLS PASSED — 35 bảng có chính sách; MUST_NOT_LEAK 0 rò rỉ giữa tenant" },
  { cmd: "test:smoke", expected: "E2E PASSED — 13 workflow X.Office chạy end-to-end" },
  { cmd: "test:controlplane", expected: "CONTROL PLANE PASSED — reset + smoke bộ điều phối control-plane" },
  { cmd: "test:mdm", expected: "MDM PASSED — dữ liệu chủ (đơn vị/vị trí/vai trò) nhất quán" },
  { cmd: "test:backup", expected: "BACKUP PASSED — 30 assertions; tạo gói + checksum" },
  { cmd: "test:records", expected: "RECORDS PASSED — kho tài liệu bất biến + phiên bản", note: "PASSED kèm teardown libuv (Windows) — đã xác minh không phải lỗi" },
  { cmd: "test:webhook", expected: "WEBHOOK PASSED — phát/nhận sự kiện webhook", note: "PASSED kèm teardown libuv (Windows) — đã xác minh không phải lỗi" },
  { cmd: "test:condition", expected: "CONDITION AST PASSED — 20 cases; bộ điều kiện quy trình" },
  { cmd: "test:authz", expected: "AUTHZ PASSED — allow 201 / deny 403 / 401 / OIDC", note: "PASSED kèm teardown libuv (Windows) — đã xác minh không phải lỗi" },
  { cmd: "test:roles", expected: "ROLE REGISTRY PASSED — vai trò + ma trận quyền resolve đúng" },
  { cmd: "test:auth-flow", expected: "AUTH FLOW PASSED — login / invite→activate / forgot→reset / revoke" },
  { cmd: "test:requests", expected: "REQUESTS PASSED — Request Center tạo→submit→duyệt→thực thi" },
  { cmd: "test:directives", expected: "DIRECTIVES PASSED — chỉ đạo issue→acknowledge→accept" },
  { cmd: "test:tickets", expected: "TICKETS PASSED — Service Desk tạo→assign→resolve→CSAT" },
  { cmd: "test:bookings", expected: "BOOKINGS PASSED — đặt chỗ tạo→duyệt→check-in + xung đột 409" },
  { cmd: "test:announcements", expected: "ANNOUNCEMENTS PASSED — publish→read→acknowledge→remind" },
  { cmd: "test:tenant-registry", expected: "TENANT REGISTRY PASSED — sổ đăng ký tenant + trạng thái/lớp" },
  { cmd: "test:platform-console", expected: "PLATFORM CONSOLE PASSED — quyền platform-operator + tổng quan" },
  { cmd: "test:launch-factory", expected: "LAUNCH FACTORY PASSED — khởi chạy tenant qua 8 bước tiến trình" },
  { cmd: "test:catalog", expected: "CATALOG PASSED — seed + smoke blueprint & seed-pack" },
  { cmd: "test:delivery", expected: "DELIVERY PASSED — engagement/triển khai khách hàng" },
  { cmd: "test:t002", expected: "T002 PASSED — provision + cách ly tenant realestate-demo", note: "PASSED kèm teardown libuv (Windows) — đã xác minh không phải lỗi" },
  { cmd: "test:demos", expected: "DEMOS PASSED — provision + smoke bộ tenant demo" },
  { cmd: "test:backup-schedule", expected: "BACKUP SCHEDULE PASSED — lịch backup định kỳ mỗi tenant" },
  { cmd: "scan:secrets", expected: "SECRET SCAN PASSED — 0 secret lộ ngoài .env" },
];

export const BOT_TEST_UPDATED = "2026-07-30";

export interface UserTestRow {
  id: string;
  group: string;
  step: string;
  expected: string;
  link?: string;
}

// UAT toàn hệ thống — mirror docs/TEST_LOG.md §3. Mọi link trỏ route thật.
// Ghi chú vai trò: [ADMIN] chỉ admin/quản trị · [PLATFORM] chỉ platform-operator · [ENFORCE] cần bật enforcement.
export const USER_TEST_ROWS: UserTestRow[] = [
  // ── Điều hướng & UI ──
  { id: "U1", group: "Điều hướng & UI", step: "Xem icon rail bên trái", expected: "Đúng 5 workspace: Trang chủ · Công việc · X.Space · X.Office · Doanh nghiệp (không có item 'Thiết lập' thừa)", link: "/home/me" },
  { id: "U2", group: "Điều hướng & UI", step: "Bấm từng workspace trên rail", expected: "Panel 'prime' con hiện đúng các màn của workspace đang chọn", link: "/home/me" },
  { id: "U3", group: "Điều hướng & UI", step: "Thu gọn menu (nút 'Thu gọn / Mở menu')", expected: "Rail thu gọn → menu chuyển thành header ngang có icon; mở lại về panel dọc; icon back chevron đúng" },
  { id: "U4", group: "Điều hướng & UI", step: "Thu nhỏ cửa sổ / mở trên mobile → hamburger", expected: "Hiện drawer hamburger; drawer liệt kê menu theo workspace đang chọn" },
  { id: "U5", group: "Điều hướng & UI", step: "Mở Sơ đồ đơn vị → nút toàn màn hình", expected: "Org-chart fullscreen phủ luôn rail bên trái; thoát fullscreen trả lại layout", link: "/admin/organization" },
  { id: "U6", group: "Điều hướng & UI", step: "Chuyển sáng / tối (theme toggle)", expected: "Toàn bộ màu nền/chữ đổi đồng bộ; không có mảng trắng/đen lệch tông" },
  { id: "U7", group: "Điều hướng & UI", step: "Mở /docs xem các tab", expected: "6 tab tài liệu: Phát triển · Hướng dẫn · Nghiệp vụ · SaaS · Backlog · Kiểm thử; mỗi tab render markdown + TOC", link: "/docs" },

  // ── Xác thực ──
  { id: "U8", group: "Xác thực", step: "Mở /login đăng nhập", expected: "Form login render; đăng nhập đúng → vào app; sai → báo lỗi", link: "/login" },
  { id: "U9", group: "Xác thực", step: "Luồng mời → kích hoạt (/activate) [ENFORCE]", expected: "Link mời mở /activate; đặt mật khẩu → tài khoản active, đăng nhập được", link: "/activate" },
  { id: "U10", group: "Xác thực", step: "Quên mật khẩu /forgot → /reset [ENFORCE]", expected: "Nhập email ở /forgot → nhận link; /reset đặt mật khẩu mới; đăng nhập bằng mật khẩu mới", link: "/forgot" },
  { id: "U11", group: "Xác thực", step: "Thu hồi phiên khi treo tài khoản [ADMIN][ENFORCE]", expected: "Suspend user ở /admin/users → phiên hiện tại của user đó bị vô hiệu (đăng xuất buộc)", link: "/admin/users" },
  { id: "U12", group: "Xác thực", step: "Chọn tenant (/select-tenant)", expected: "User đa tenant thấy danh sách tenant; chọn 1 → vào đúng workspace tenant đó", link: "/select-tenant" },

  // ── Quản trị & Tổ chức ──
  { id: "U13", group: "Quản trị & Tổ chức", step: "Mở /admin tổng quan [ADMIN]", expected: "Chip 'Control Plane trực tiếp'; số liệu người dùng/đơn vị/vị trí/xung đột/kết nối live", link: "/admin" },
  { id: "U14", group: "Quản trị & Tổ chức", step: "/admin/users — danh sách + mời [ADMIN]", expected: "Chip live; các thành viên với chức danh/đơn vị/vai trò resolve thật; nút mời mở drawer", link: "/admin/users" },
  { id: "U15", group: "Quản trị & Tổ chức", step: "/admin/organization — Sơ đồ đơn vị [ADMIN]", expected: "Chip 'Dữ liệu trực tiếp (/api/identity)'; cây đơn vị + trưởng đơn vị thật", link: "/admin/organization" },
  { id: "U16", group: "Quản trị & Tổ chức", step: "Sơ đồ nhân sự (avatar/email/sđt) [ADMIN]", expected: "Chuyển sang chế độ sơ đồ nhân sự; mỗi node hiện avatar, email, số điện thoại thật", link: "/admin/organization" },
  { id: "U17", group: "Quản trị & Tổ chức", step: "Cấu hình node đơn vị [ADMIN]", expected: "Đổi tên / gán trưởng / thêm đơn vị con / di chuyển / xoá node — thao tác lưu và cây cập nhật", link: "/admin/organization" },
  { id: "U18", group: "Quản trị & Tổ chức", step: "In / Xuất PDF sơ đồ [ADMIN]", expected: "Nút In/Xuất PDF tạo file sơ đồ đúng bố cục", link: "/admin/organization" },
  { id: "U19", group: "Quản trị & Tổ chức", step: "/admin/positions — vị trí + kiêm nhiệm [ADMIN]", expected: "Timeline vị trí theo thời gian; hiển thị acting/kiêm nhiệm đúng", link: "/admin/positions" },
  { id: "U20", group: "Quản trị & Tổ chức", step: "/admin/roles — vai trò + ma trận quyền [ADMIN]", expected: "Danh sách vai trò + ma trận quyền; 'test-as-user' xem quyền hiệu lực của 1 user", link: "/admin/roles" },
  { id: "U21", group: "Quản trị & Tổ chức", step: "/admin/data-scopes — phạm vi dữ liệu [ADMIN]", expected: "Cấu hình data-scope (đơn vị/vùng) hiển thị và lưu đúng", link: "/admin/data-scopes" },
  { id: "U22", group: "Quản trị & Tổ chức", step: "/admin/delegations — uỷ quyền [ADMIN]", expected: "Màn uỷ quyền; guardrail SELF_DELEGATION gắn cờ khi tự uỷ quyền cho mình", link: "/admin/delegations" },
  { id: "U23", group: "Quản trị & Tổ chức", step: "/admin/backups → '+ Tạo bản sao lưu' [ADMIN]", expected: "Drawer mở, submit → gói mới xuất hiện, Checksum PASS, dung lượng hiển thị", link: "/admin/backups" },
  { id: "U24", group: "Quản trị & Tổ chức", step: "/admin/restores — phục hồi [ADMIN]", expected: "Danh sách bản phục hồi; chọn gói → mô phỏng khôi phục hiển thị trạng thái", link: "/admin/restores" },
  { id: "U25", group: "Quản trị & Tổ chức", step: "/admin/audit — nhật ký kiểm toán [ADMIN]", expected: "Log audit các thao tác quản trị; lọc/tra cứu được", link: "/admin/audit" },
  { id: "U26", group: "Quản trị & Tổ chức", step: "/admin/settings/tenant — provisioning [ADMIN]", expected: "Panel provisioning live; toggle Bật/Tắt app; nút 'Đối soát' → consistent", link: "/admin/settings/tenant" },

  // ── X.Office ──
  { id: "U27", group: "X.Office", step: "Request Center /office/requests — tạo→submit→duyệt", expected: "Tạo yêu cầu → submit → người duyệt approve; trạng thái chuyển đúng", link: "/office/requests" },
  { id: "U28", group: "X.Office", step: "Yêu cầu — comment + đính kèm + thực thi/bằng chứng", expected: "Thêm bình luận & tệp đính kèm; bước execute ghi nhận evidence", link: "/office/requests" },
  { id: "U29", group: "X.Office", step: "My Requests /office/my-requests", expected: "Chỉ hiện yêu cầu của chính mình; trạng thái đồng bộ với Request Center", link: "/office/my-requests" },
  { id: "U30", group: "X.Office", step: "Directive /office/directives — issue→acknowledge→accept", expected: "Tạo chỉ đạo → issue → người nhận acknowledge → accept; timeline ghi nhận", link: "/office/directives" },
  { id: "U31", group: "X.Office", step: "Service Desk /office/service-desk — ticket vòng đời", expected: "Tạo ticket → assign → resolve → CSAT; SLA/trạng thái cập nhật", link: "/office/service-desk" },
  { id: "U32", group: "X.Office", step: "Booking /office/bookings — tạo→duyệt→check-in", expected: "Đặt chỗ tạo→duyệt→check-in; đặt trùng khung giờ trả xung đột (409)", link: "/office/bookings" },
  { id: "U33", group: "X.Office", step: "Announcement /office/announcements — publish→read→ack→remind", expected: "Publish thông báo → người nhận read → acknowledge → báo cáo tỷ lệ + nhắc lại (remind)", link: "/office/announcements" },
  { id: "U34", group: "X.Office", step: "Inbox /inbox — hộp việc", expected: "Các work-item cần xử lý gom về hộp việc; mở item → sang màn xử lý đúng", link: "/inbox" },
  { id: "U35", group: "X.Office", step: "Approvals /approvals — hàng chờ duyệt", expected: "Danh sách chờ duyệt tập trung; approve/reject cập nhật nguồn", link: "/approvals" },
  { id: "U36", group: "X.Office", step: "Workflows /office/workflows — quy trình", expected: "Danh sách quy trình; mở builder/form/versions của 1 quy trình hiển thị đúng", link: "/office/workflows" },
  { id: "U37", group: "X.Office", step: "Monitor /office/monitor — giám sát vận hành", expected: "Bảng giám sát instance/quy trình đang chạy hiển thị số liệu", link: "/office/monitor" },

  // ── Tài liệu ──
  { id: "U38", group: "Tài liệu", step: "Mở /documents", expected: "Chip 'Kho tài liệu trực tiếp (/api/records)'; danh sách tài liệu; Dung lượng + Phiên bản có số thật", link: "/documents" },
  { id: "U39", group: "Tài liệu", step: "Mở 1 tài liệu — lịch sử phiên bản", expected: "Timeline phiên bản bất biến (bản hiện hành / bản cũ), size/mime/tác giả/sha256", link: "/documents" },
  { id: "U40", group: "Tài liệu", step: "'+ Tải tài liệu' (upload)", expected: "Drawer upload → tạo tài liệu mới thật, quay lại thấy trong danh sách", link: "/documents" },
  { id: "U41", group: "Tài liệu", step: "'Phiên bản mới' + 'Tải nội dung'", expected: "Thêm version (+1, bản cũ giữ nguyên); tải nội dung 1 phiên bản đúng nội dung", link: "/documents" },

  // ── X.Space ──
  { id: "U42", group: "X.Space", step: "Kênh /space/home + kênh", expected: "Danh sách kênh; mở 1 kênh xem overview/threads/lists", link: "/space/home" },
  { id: "U43", group: "X.Space", step: "Nhắn trực tiếp (DM)", expected: "Mở DM tới 1 người; gửi/nhận tin hiển thị đúng luồng", link: "/space/home" },
  { id: "U44", group: "X.Space", step: "Khách hàng 360 /customers", expected: "Danh sách khách hàng; mở hồ sơ 360 (thông tin + hoạt động) đầy đủ", link: "/customers" },

  // ── Platform Console ──
  { id: "U45", group: "Platform Console", step: "/platform tổng quan [PLATFORM]", expected: "Chỉ platform-operator thấy; dashboard tổng quan vận hành nền tảng live", link: "/platform" },
  { id: "U46", group: "Platform Console", step: "/platform/tenants — danh sách tenant [PLATFORM]", expected: "Liệt kê 10 tenant (T001–T010) kèm status / class / blueprint", link: "/platform/tenants" },
  { id: "U47", group: "Platform Console", step: "Đăng ký / onboard tenant khách [PLATFORM]", expected: "Luồng đăng ký tenant mới; tenant xuất hiện trong sổ đăng ký với trạng thái onboard", link: "/platform/tenants" },
  { id: "U48", group: "Platform Console", step: "/platform/launches — khởi chạy tenant [PLATFORM]", expected: "Tạo launch; tiến trình 8 bước chạy tuần tự và cập nhật trạng thái từng bước", link: "/platform/launches" },
  { id: "U49", group: "Platform Console", step: "/platform/blueprints + /platform/seed-packs [PLATFORM]", expected: "Danh mục blueprint & seed-pack; mở chi tiết 1 mục hiển thị cấu phần", link: "/platform/blueprints" },
  { id: "U50", group: "Platform Console", step: "/platform/backups — lịch backup + Chạy ngay [PLATFORM]", expected: "Lịch backup định kỳ mỗi tenant; nút 'Chạy ngay' tạo gói tức thì", link: "/platform/backups" },
  { id: "U51", group: "Platform Console", step: "/delivery — triển khai khách hàng [PLATFORM]", expected: "Danh sách engagement triển khai; mở 1 engagement xem tiến độ", link: "/delivery" },

  // ── Đa tenant (cách ly) ──
  { id: "U52", group: "Đa tenant", step: "Đăng nhập user T002 (tenant-realestate-demo) [ENFORCE]", expected: "Thấy đúng dữ liệu T002 (người dùng/đơn vị/tài liệu của T002)", link: "/login" },
  { id: "U53", group: "Đa tenant", step: "Kiểm tra cách ly khỏi T001 [ENFORCE]", expected: "User T002 KHÔNG thấy bất kỳ bản ghi nào của T001; RLS chặn rò rỉ", link: "/documents" },
  { id: "U54", group: "Đa tenant", step: "Tài liệu T002 vào folder riêng [ENFORCE]", expected: "Tài liệu T002 lưu ở folder/tenant riêng, tách biệt lưu trữ T001", link: "/documents" },

  // ── Console kỹ thuật ──
  { id: "U55", group: "Console kỹ thuật", step: "DevTools Console khi lướt tất cả màn", expected: "0 lỗi đỏ (JS error / failed fetch) trên mọi route đã mở" },
];

export const USER_TEST_GROUPS = [
  "Điều hướng & UI",
  "Xác thực",
  "Quản trị & Tổ chức",
  "X.Office",
  "Tài liệu",
  "X.Space",
  "Platform Console",
  "Đa tenant",
  "Console kỹ thuật",
] as const;
