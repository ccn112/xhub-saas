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
  { cmd: "test:work-item", expected: "WORK ITEM PASSED — NativeWorkItem CRUD + FSM + tag/dimension" },
  { cmd: "test:work-project", expected: "WORK PROJECT PASSED — ExecutionProject WBS + phụ thuộc FS/SS/FF/SF + baseline" },
  { cmd: "test:work-views", expected: "WORK VIEWS PASSED — Gantt phối hợp (SUMMARY vs FULL) + Kanban + thống kê đa chiều cross-tab đúng số + reschedule 400 khi phá vỡ phụ thuộc" },
  { cmd: "test:manage-slice", expected: "MANAGE SLICE PASSED — 28 assertions: Mục tiêu→KPI(từ Work)→Review→Quyết định→Action→NativeWorkItem→Follow-up + cách ly tenant" },
  { cmd: "test:manage-okr", expected: "MANAGE OKR PASSED — 25 assertions: KPI-tree theo góc nhìn, KPI đỏ không bị điểm gộp che, check-in giữ lịch sử (không sửa/xoá), cách ly tenant" },
  { cmd: "test:manage-industry", expected: "MANAGE INDUSTRY PASSED — 9 tenant có Mục tiêu/KPI/OKR đúng đặc thù ngành (0 trùng lặp ngoài ACT-CLOSE); T001 không bị ghi đè" },
  { cmd: "test:ioc-twin", expected: "IOC TWIN PASSED — 44 assertions: mặt bằng/scene/publish-rollback bất biến, gán vùng vào OrgUnit thật, 2D luôn dùng được khi tắt WebGL" },
  { cmd: "test:ioc-data-layer", expected: "IOC DATA LAYER PASSED — 45 assertions: lớp dữ liệu chiếu từ Work thật (không lưu số riêng), cấm camera/chấm công/sinh trắc học (403), quyền xem cá nhân + audit" },
  { cmd: "scan:secrets", expected: "SECRET SCAN PASSED — 0 secret lộ ngoài .env" },
];

export const BOT_TEST_UPDATED = "2026-08-01";

// ── Setup / hướng dẫn cho người test mới (chưa biết code) ──────────────────
export interface TestAccount {
  tag: string; // badge hiển thị, khớp với [TAG] trong cột "Bước" của USER_TEST_ROWS
  name: string;
  email: string;
  password: string;
  note: string;
}

// Tài khoản demo đăng nhập KHÔNG cần mật khẩu (chỉ gõ email, để trống ô Mật khẩu,
// bấm Đăng nhập — hoặc bấm thẳng tên trong "Chọn nhanh (demo)"). Nguồn thật:
// xhub-web/src/data/seed/all.seed.json (16 người dùng tenant-xtech) — xem
// xhub-api/scripts/authz-smoke.mjs, platform-console-smoke.mjs, catalog-smoke.mjs
// (dùng đúng user-nam làm PLATFORM_ADMIN['*'] cho mọi test tự động).
export const TEST_ACCOUNTS: TestAccount[] = [
  {
    tag: "ADMIN / PLATFORM",
    name: "Nguyễn Hoài Nam (Giám đốc Công nghệ)",
    email: "nam.nguyen@xtech.com.vn",
    password: "(để trống)",
    note: "Tài khoản có mọi quyền (PLATFORM_ADMIN — quyền '*'). Dùng cho MỌI dòng có nhãn [ADMIN] hoặc [PLATFORM]. Đây cũng là tài khoản mặc định để test các màn không ghi nhãn vai trò.",
  },
  {
    tag: "NHÂN VIÊN THƯỜNG",
    name: "Trần Thu Hà (Trưởng nhóm Kinh doanh)",
    email: "ha.tran@xtech.com.vn",
    password: "(để trống)",
    note: "Tài khoản KHÔNG có quyền quản trị — dùng để xác nhận khu Quản trị (/admin/*) và Platform Console (/platform/*) KHÔNG hiện ra cho người dùng thường.",
  },
  {
    tag: "T002 (đa tenant)",
    name: "Admin tenant Chủ đầu tư BĐS Demo (tenant-realestate-demo)",
    email: "(userId: tenant-realestate-demo-admin)",
    password: "cần dev cấp — xem ghi chú",
    note: "Tài khoản này KHÔNG đăng nhập được bằng cách chọn nhanh (không nằm trong danh sách 16 người tenant-xtech). Mật khẩu được sinh ngẫu nhiên mỗi lần chạy `npm run provision:t002` ở xhub-api và chỉ in ra console lúc đó (biến môi trường T002_ADMIN_PASSWORD/T002_EMP_PASSWORD nếu dev đặt trước). Nếu bạn cần test nhóm 'Đa tenant' (U52–U54), hãy nhờ dev cung cấp mật khẩu hiện hành hoặc chạy lại lệnh trên và gửi bạn kết quả.",
  },
];

// Ghi chú vai trò dùng trong cột "Bước": [ADMIN] chỉ tài khoản quản trị tenant ·
// [PLATFORM] chỉ tài khoản vận hành nền tảng (platform-operator) · [ENFORCE] màn
// này chỉ có thể kiểm tra khi máy chủ đang BẬT chế độ AUTH_ENFORCE=true; ở môi
// trường demo mặc định (AUTH_ENFORCE=false) các dòng [ENFORCE] không áp dụng
// được — tick "Chưa test" và ghi chú "N/A demo mode", ĐỪNG tính là FAIL.
export const TEST_SETUP_GUIDE = {
  appUrl: "http://localhost:3000",
  apiUrl: "http://localhost:4000 (backend — không cần mở trực tiếp, chỉ cần đang chạy)",
  steps: [
    "Mở trình duyệt tới http://localhost:3000/login (nếu máy chủ chạy ở cổng khác — 3001 — thay số cổng tương ứng, hỏi dev nếu không chắc).",
    "Ở khung 'Chọn nhanh (demo, không mật khẩu)' phía dưới form, bấm thẳng vào tên tài khoản bạn cần (xem bảng Tài khoản test bên dưới) — KHÔNG cần gõ gì thêm. Hoặc gõ email vào ô 'Email hoặc userId', để trống ô Mật khẩu, bấm Đăng nhập.",
    "Sau khi vào ứng dụng, mở tab Tài liệu (biểu tượng Doanh nghiệp → Tài liệu, hoặc gõ thẳng /docs) rồi chọn tab 'Kiểm thử' — đây chính là trang bạn đang xem.",
    "Đi theo từng nhóm từ trên xuống dưới. Với mỗi dòng: bấm 'Mở màn ↗' để mở đúng màn cần test ở tab mới, làm theo cột 'Bước', rồi so kết quả thực tế với cột 'Kỳ vọng'.",
    "Bấm nút PASS hoặc FAIL cho dòng đó (khung 3 nút bên phải mỗi dòng). Có thể gõ thêm Ghi chú nếu FAIL (mô tả lỗi thấy được, không cần thuật ngữ kỹ thuật).",
    "Kết quả tự lưu khi bạn tick (badge góc phải bảng: 'Đã lưu máy chủ' = đã đồng bộ, 'Lưu cục bộ (offline)' = máy chủ tạm không phản hồi nhưng dữ liệu vẫn ở trên máy bạn).",
    "Khi test xong (hoặc xong một phiên), bấm nút 'Sao chép kết quả' — nội dung dạng bảng Markdown được chép vào clipboard, dán vào email/chat gửi cho người phụ trách.",
    "Gặp màn không mở được, nút không phản hồi, hoặc lỗi hiển thị lạ: chụp màn hình + ghi lại đường dẫn (URL) đang mở, gửi kèm khi báo cáo.",
  ],
  enforceNote:
    "[ENFORCE] = màn/luồng đó chỉ thể hiện đúng khi máy chủ API bật AUTH_ENFORCE=true. Ở môi trường demo mặc định (đa số trường hợp) biến này TẮT — các dòng [ENFORCE] không kiểm tra được, hãy để 'Chưa test' và ghi chú 'N/A demo mode', KHÔNG tính là FAIL.",
  reportTo:
    "Gửi kết quả (bấm 'Sao chép kết quả' rồi dán) cho quản trị viên tenant X-TECH phụ trách XHub, hoặc bộ phận IT phụ trách nền tảng. Nếu không rõ người nhận, hỏi người đã gửi bạn tài liệu này.",
};

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

  // ── Công việc (Work v2) ──
  { id: "U56", group: "Công việc", step: "Danh sách dự án /work/projects → mở 1 dự án", expected: "Thấy danh sách ExecutionProject; mở chi tiết 1 dự án hiển thị WBS/tiến độ/baseline", link: "/work/projects" },
  { id: "U57", group: "Công việc", step: "Gantt — mở nút 'Gantt' trên chi tiết dự án", expected: "Timeline kéo dài theo ngày; thanh kế hoạch vs thực tế; đường phụ thuộc FS/SS/FF/SF; mốc milestone; cây WBS thu/mở", link: "/work/projects" },
  { id: "U58", group: "Công việc", step: "Gantt — kéo/resize 1 thanh việc", expected: "Ngày cập nhật ngay (optimistic); nếu đổi ngày phá vỡ phụ thuộc FS → báo lỗi, tự rollback về ngày cũ" },
  { id: "U59", group: "Công việc", step: "Gantt phối hợp — mở link chia sẻ dạng SUMMARY", expected: "CHỈ thấy thanh việc CHA (tiêu đề + % tiến độ + ngày); KHÔNG thấy việc con, KHÔNG thấy mô tả chi tiết; có badge 'Chia sẻ phối hợp'" },
  { id: "U60", group: "Công việc", step: "Bảng Kanban /work/board", expected: "Cột theo trạng thái; kéo thẻ đổi cột → trạng thái lưu server (rollback nếu trạng thái không hợp lệ); có thể gom nhóm theo tag/chiều phân tích", link: "/work/board" },
  { id: "U61", group: "Công việc", step: "Lịch /work/calendar", expected: "Lưới tháng hiện việc theo hạn (dueAt) + milestone; bấm 1 việc mở chi tiết", link: "/work/calendar" },
  { id: "U62", group: "Công việc", step: "Danh mục dự án /work/portfolio", expected: "Thẻ KPI: số dự án đang chạy/đỏ/quá hạn/nghẽn; biểu đồ sức khỏe; bấm vào bảng dự án chi tiết", link: "/work/portfolio" },
  { id: "U63", group: "Công việc", step: "Thống kê đa chiều /work/reports", expected: "Chọn trục hàng (tag/chiều/status/loại/ưu tiên/dự án) × trục cột × chỉ số (đếm/tiến độ TB/quá hạn) → bảng pivot + biểu đồ cột đúng số", link: "/work/reports" },

  // ── Quản trị (Management OS) ──
  { id: "U64", group: "Quản trị", step: "Trang chủ điều hành /manage", expected: "Thẻ sức khỏe: số mục tiêu đúng tiến độ, KPI đỏ, quyết định đang mở, action quá hạn — số liệu thật", link: "/manage" },
  { id: "U65", group: "Quản trị", step: "Mục tiêu chiến lược /manage/objectives", expected: "4 mục tiêu (Tăng trưởng/Khách hàng/Vận hành/Năng lực) mở chi tiết 1 mục tiêu → thấy chỉ số liên kết", link: "/manage/objectives" },
  { id: "U66", group: "Quản trị", step: "Chỉ số /manage/metrics — KPI ACT-CLOSE", expected: "Biểu đồ tỷ lệ cam kết đúng hạn tính TỪ dữ liệu Work thật (không nhập tay); giá trị khớp số việc quá hạn thực tế", link: "/manage/metrics" },
  { id: "U67", group: "Quản trị", step: "Review /manage/reviews — mở 1 review tháng", expected: "Pre-read: snapshot chỉ số + ngoại lệ (RAG) → quyết định RAPID → action; bấm action → sang đúng việc thật /work/items/[id]", link: "/manage/reviews" },
  { id: "U68", group: "Quản trị", step: "Đóng 1 review", expected: "Trạng thái review chuyển sang 'Follow-up'/'Đã đóng'; follow-up được ghi nhận" },
  { id: "U69", group: "Quản trị", step: "Quyết định /manage/decisions", expected: "Danh sách quyết định kiểu RAPID (Recommend/Agree/Decide/Input/Perform); có độ tuổi (aging) của quyết định chưa xử lý", link: "/manage/decisions" },
  { id: "U85", group: "Quản trị", step: "Scorecard /manage/scorecards", expected: "4 góc nhìn (Tài chính/Khách hàng/Vận hành/Năng lực); KPI đỏ hiển thị RÕ RÀNG — không bị điểm gộp/trung bình che đi", link: "/manage/scorecards" },
  { id: "U86", group: "Quản trị", step: "OKR /manage/okrs — mở chu kỳ 2026Q3", expected: "2 mục tiêu O-001/O-002, mỗi mục tiêu có Key Result kèm % tin cậy; Key Result liên kết Initiative/Action — KHÔNG phải danh sách task thô", link: "/manage/okrs" },
  { id: "U87", group: "Quản trị", step: "Thêm 1 check-in cho 1 Key Result", expected: "Check-in mới xuất hiện; lịch sử check-in CŨ vẫn còn nguyên (không bị ghi đè/xoá)" },

  // ── Đa tenant · KPI/OKR theo ngành ──
  { id: "U88", group: "Đa tenant", step: "Đăng nhập tenant T003 (Sản xuất) → /manage/objectives + /manage/metrics", expected: "Mục tiêu/KPI về SẢN XUẤT thật (OEE, tỷ lệ lỗi/phế phẩm, MTBF, OTIF) — KHÔNG phải bộ KPI văn phòng/công nghệ của T001", link: "/manage/objectives" },
  { id: "U89", group: "Đa tenant", step: "So sánh với tenant T004 (Phân phối/Bán lẻ) → /manage/objectives", expected: "Bộ KPI khác hẳn T003 (vòng quay tồn kho, hàng chết, CAC…) — chỉ trùng đúng 1 chỉ số chung ACT-CLOSE (tính từ Work)", link: "/manage/objectives" },

  // ── IOC — Bản sao số (Digital Twin, DT-01→DT-03) ──
  { id: "U71", group: "IOC — Bản sao số", step: "Trung tâm điều hành /ioc", expected: "Thẻ: bảng điều khiển đã xuất bản, scene đã xuất bản, số lớp dữ liệu, số phòng ban bận/quá tải — số liệu thật, không phải mẫu", link: "/ioc" },
  { id: "U72", group: "IOC — Bản sao số", step: "Bản sao số văn phòng /ioc/twin/office", expected: "Mặt bằng 2D hiện 8 vùng với TÊN PHÒNG BAN THẬT (Ban Điều hành, Kinh doanh, Tài chính…) + màu theo mức tải; thẻ KPI khớp số ở bảng bên dưới", link: "/ioc/twin/office" },
  { id: "U73", group: "IOC — Bản sao số", step: "Bấm tab 'Không gian 3D' ở màn twin", expected: "Hiện khối 3D xoay/zoom được, chiều cao khối theo mức tải; đóng tab về 2D vẫn nguyên dữ liệu" },
  { id: "U74", group: "IOC — Bản sao số", step: "TẮT WebGL trong trình duyệt rồi mở lại /ioc/twin/office (AT-007)", expected: "Trang VẪN dùng được đầy đủ: mặt bằng 2D + danh sách vùng + KPI hiện đủ; chỉ báo '3D không khả dụng', không có màn trắng/lỗi", link: "/ioc/twin/office" },
  { id: "U75", group: "IOC — Bản sao số", step: "Twin Studio /ioc/studio", expected: "Chuỗi cấu hình 7 bước + danh sách scene/mặt bằng với trạng thái và số phiên bản", link: "/ioc/studio" },
  { id: "U76", group: "IOC — Bản sao số", step: "Trình vẽ mặt bằng: chọn 1 vùng, đổi tên, kéo 1 đỉnh", expected: "Lưới 1 m + thước tỷ lệ; kéo đỉnh đổi hình; sau ~1,5s tự lưu, hiện 'Đã lưu bản nháp (revision N)'" },
  { id: "U77", group: "IOC — Bản sao số", step: "Trình vẽ: công cụ 'Vẽ vùng' → bấm 4 điểm → Hoàn tất; thử vẽ hình nơ (tự cắt)", expected: "Vùng hợp lệ được tạo; hình tự cắt bị chặn kèm thông báo (máy chủ cũng từ chối)" },
  { id: "U78", group: "IOC — Bản sao số", step: "Trình vẽ: gán 1 vùng cho đơn vị + chọn icon, rồi Hoàn tác/Làm lại", expected: "Nhãn vùng đổi thành tên đơn vị thật + icon; Ctrl+Z / Ctrl+Shift+Z hoạt động" },
  { id: "U79", group: "IOC — Bản sao số", step: "Trình vẽ: bấm 'Xuất bản phiên bản' 2 lần (có sửa ở giữa)", expected: "Tạo v1 rồi v2 kèm checksum; v1 chuyển SUPERSEDED chứ KHÔNG bị sửa/xoá" },
  { id: "U80", group: "IOC — Bản sao số", step: "Lớp dữ liệu /ioc/studio/data-layers", expected: "Mỗi lớp hiện kết quả trực tiếp theo phòng ban; phần Catalog ghi rõ hệ thống nguồn (SoR) và cảnh báo cấm camera/chấm công/sinh trắc học", link: "/ioc/studio/data-layers" },
  { id: "U81", group: "IOC — Bản sao số", step: "Tạo 1 việc mới ở /work/tasks rồi tải lại /ioc/studio/data-layers", expected: "Tổng tải của phòng ban tương ứng TĂNG — chứng tỏ IOC chiếu dữ liệu Work thật, không lưu số riêng", link: "/work/tasks" },
  { id: "U82", group: "IOC — Bản sao số", step: "Bảng điều khiển /ioc/studio/dashboards", expected: "Xem trước bố cục lưới 12 cột đúng như màn twin; danh mục widget được phép hiển thị đầy đủ", link: "/ioc/studio/dashboards" },
  { id: "U83", group: "IOC — Bản sao số", step: "Rà soát & xuất bản /ioc/studio/publish", expected: "Bảng lịch sử phiên bản cho mặt bằng/scene/bảng điều khiển kèm checksum + trạng thái PUBLISHED/SUPERSEDED", link: "/ioc/studio/publish" },
  { id: "U84", group: "IOC — Bản sao số", step: "Icon & asset /ioc/studio/assets", expected: "14 icon dựng sẵn; mục tải asset tuỳ chỉnh ghi rõ CHƯA MỞ kèm lý do an toàn", link: "/ioc/studio/assets" },
  { id: "U101", group: "IOC — Bản sao số", step: "Bấm 1 vùng trên mặt bằng 2D ở /ioc/twin/office", expected: "Cột phải đổi từ 'AI Twin Brief' sang 'Chi tiết vùng: <tên phòng ban>' — hiện danh sách người giữ vị trí (tên thật + chức danh), việc đang xử lý, cảnh báo của đúng vùng đó; nút 'Quay lại AI Twin Brief' trả về màn cũ", link: "/ioc/twin/office" },
  { id: "U102", group: "IOC — Bản sao số", step: "Chuyển sang tab 'Không gian 3D' rồi bấm 1 khối vùng khác", expected: "Cùng panel chi tiết vùng cập nhật đúng theo khối vừa bấm (không cần rời màn 3D); khối đang chọn sáng lên rõ hơn các khối khác" },
  { id: "U103", group: "IOC — Bản sao số", step: "Đăng nhập bằng tài khoản KHÔNG có quyền xem chi tiết cá nhân (ví dụ nhân viên thường), bấm 1 vùng", expected: "Panel báo lỗi rõ ràng (không phải màn trắng) — từ chối xem roster cá nhân, đúng tinh thần 'dữ liệu cá nhân cần quyền riêng'" },
  { id: "U104", group: "IOC — Bản sao số", step: "Khối 'Xu hướng chỉ số (thật)' trong AI Twin Brief", expected: "Hiện cột chỉ số + mini biểu đồ cột từ các kỳ MetricObservation thật (không phải luôn 'chưa đủ dữ liệu')" },
  { id: "U105", group: "IOC — Bản sao số", step: "Khối 'Phân bố giờ vào/ra' cuối trang /ioc/twin/office", expected: "Biểu đồ cột 24 giờ, xanh=vào/xanh dương=ra, dựng từ AttendanceEvent thật (PE-02); nếu tenant chưa import chấm công thì hiện đúng lý do trung thực thay vì biểu đồ trống", link: "/ioc/twin/office" },

  // ── Nhân sự & Công (PE-01 Leave & Availability, SME Lite) ──
  { id: "U90", group: "Nhân sự & Công", step: "Trang chủ /people", expected: "Thẻ số dư theo từng loại nghỉ (nghỉ phép năm/ốm/không lương/nghỉ bù/từ xa) khớp seed:people-leave; đơn đang chờ hiện đúng", link: "/people" },
  { id: "U91", group: "Nhân sự & Công", step: "Tạo đơn nghỉ /people/leave — chọn ngày rồi bấm 'Xem trước ảnh hưởng'", expected: "Hiện mức ảnh hưởng LOW/MEDIUM/HIGH + số việc/phê duyệt/đặt phòng/chỉ đạo đến hạn trong kỳ nghỉ — số liệu thật, nút Gửi chỉ bật SAU khi đã xem trước", link: "/people/leave" },
  { id: "U92", group: "Nhân sự & Công", step: "Gửi đơn nghỉ vừa xem trước", expected: "Đơn xuất hiện ở 'Đơn của tôi' trạng thái SUBMITTED; đồng thời hiện ở /approvals và /inbox (không tạo hàng đợi duyệt riêng)", link: "/approvals" },
  { id: "U93", group: "Nhân sự & Công", step: "Gửi lại đơn y hệt (double-click nhanh nút Gửi)", expected: "KHÔNG tạo 2 đơn trùng — idempotency chặn tạo trùng dù bấm nhiều lần" },
  { id: "U94", group: "Nhân sự & Công", step: "Lịch hiện diện nhóm /people/team/availability — mặc định đơn vị của mình", expected: "Danh sách định biên thật (Position) + đơn đang chờ duyệt của đơn vị; bấm 'Duyệt'/'Từ chối' đổi trạng thái ngay", link: "/people/team/availability" },
  { id: "U95", group: "Nhân sự & Công", step: "Chọn 1 đơn vị NGOÀI phạm vi quản lý của mình ở /people/team/availability", expected: "Hiện rõ thông báo 'Ngoài phạm vi của bạn' (403 do DataScope) — KHÔNG hiện lẫn lộn với 'Backend offline'", link: "/people/team/availability" },
  { id: "U96", group: "Nhân sự & Công", step: "Duyệt 1 đơn nghỉ rồi quay lại /people", expected: "Số dư (available) giảm đúng bằng số ngày nghỉ; đơn chuyển APPROVED", link: "/people" },
  { id: "U97", group: "Nhân sự & Công", step: "Huỷ 1 đơn đã duyệt (APPROVED) ở /people/leave", expected: "Chuyển CANCEL_REQUESTED trước, không huỷ thẳng; sau khi HR/quản lý duyệt huỷ, số dư được hoàn lại đúng" },

  // ── Quản trị — Danh mục đầu tư (MG-04 Portfolio & Benefit) ──
  { id: "U98", group: "Quản trị", step: "Danh mục đầu tư /manage/portfolio", expected: "Portfolio PF-CORE gồm 3 initiative theo 3 giai đoạn khác nhau (stage-gate); initiative CHƯA gắn dự án hiện badge 'Chưa gắn thực thi'", link: "/manage/portfolio" },
  { id: "U99", group: "Quản trị", step: "Gắn 1 dự án thực thi có sẵn cho initiative chưa gắn", expected: "Sau khi gắn, hiện nhãn 'Nguồn: Work v2' + health/tiến độ THẬT của dự án; bấm 'Xem thực thi' sang đúng /work/projects/[id]", link: "/manage/portfolio" },
  { id: "U100", group: "Quản trị", step: "Chuyển giai đoạn 1 initiative bằng nút mũi tên", expected: "Chỉ chuyển được sang giai đoạn TIẾP THEO (không nhảy cóc); nút 'Dừng' luôn khả dụng và không quay lại được sau khi dừng" },

  // ── Console kỹ thuật ──
  { id: "U70", group: "Console kỹ thuật", step: "DevTools Console khi lướt tất cả màn", expected: "0 lỗi đỏ (JS error / failed fetch) trên mọi route đã mở" },
];

export const USER_TEST_GROUPS = [
  "Điều hướng & UI",
  "Xác thực",
  "Quản trị & Tổ chức",
  "Công việc",
  "Quản trị",
  "X.Office",
  "Tài liệu",
  "X.Space",
  "Platform Console",
  "Đa tenant",
  "Nhân sự & Công",
  "IOC — Bản sao số",
  "Console kỹ thuật",
] as const;
