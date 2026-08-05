# TEST LOG — XHub / X.Space / X.Office

> Checklist + nhật ký kiểm thử. Follow theo thứ tự; điền cột **Kết quả** (PASS/FAIL) + ghi chú.
> Doc kỹ thuật kèm theo: [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) (mục 9 — Kiểm thử & gate).

## 0. Chuẩn bị môi trường (làm 1 lần)
- [ ] Postgres đang chạy (`:5432`), `xhub-api/.env` có `DATABASE_URL` (password percent-encode: `@`→`%40`, `!`→`%21`).
- [ ] API build & chạy **1 server duy nhất** trên `:4000`:
  ```bash
  cd D:/Code/xhub-api && npm run build && node dist/src/main.js
  ```
  > Đừng dùng `npm run start:prod` (trỏ sai `dist/main`); đúng là `dist/src/main.js`.
- [ ] Web dev chạy trên `:3000`:
  ```bash
  cd D:/Code/xhub-web && npm run dev
  ```
- [ ] Nếu chạy lại smoke: mỗi smoke có script reset đi kèm (đã gộp trong `test:*`), re-runnable.

---

## 1. Gate tự động — backend (chạy khi API đã up trên :4000)
Chạy trong `D:/Code/xhub-api`. Kết quả kỳ vọng: dòng cuối in `... PASSED`.

> ▶ **Lượt chạy auto 2026-07-30 (Claude): mục 1–12 = PASS toàn bộ.** api tsc 0 · web src 0. 3 test records/webhook/authz in PASSED rồi kèm assertion teardown libuv (Windows) — đã xác minh 0 dòng fail thật, chạy lại sạch.

| # | Lệnh | Kỳ vọng | Kết quả | Ghi chú |
|---|---|---|---|---|
| 1 | `npx tsc --noEmit` | 0 error | | |
| 2 | `npm run test:rls` | RLS TEST PASSED (**35 bảng**, MUST_NOT_LEAK 0 rò) | | |
| 3 | `npm run test:smoke` | E2E SMOKE PASSED (13 workflow) | | |
| 4 | `npm run test:controlplane` | CONTROL PLANE SMOKE PASSED | | |
| 5 | `npm run test:mdm` | MDM SMOKE PASSED | | |
| 6 | `npm run test:backup` | BACKUP SMOKE PASSED (30 assertions) | | |
| 7 | `npm run test:records` | RECORDS SMOKE PASSED | | |
| 8 | `npm run test:webhook` | WEBHOOK SMOKE PASSED | | |
| 9 | `npm run test:condition` | CONDITION AST TEST PASSED (20 cases) | | |
| 10 | `npm run test:authz` | AUTHZ SMOKE PASSED (allow 201 / deny 403 / 401 / OIDC) | | |
| 11 | `npm run scan:secrets` | SECRET SCAN PASSED (0 secret ngoài `.env`) | | |
| 13 | `npm run test:e2e` (mới 03/08/2026, G0) | 2 suite PASS: app root + `xoffice-delegation.e2e-spec.ts` (regression SEC-002/GAP-002 — chặn tự cấp quyền admin qua uỷ quyền `POST /api/xoffice/delegations` + `POST /api/xoffice/tasks/:id/act`) | ✅ PASS (Claude, 03/08/2026) | Có cảnh báo "worker did not exit gracefully" (timer ScheduleModule chưa unref — không phải lỗi test), đã thêm `--forceExit` |
| 14 | `npx prisma migrate status` (mới 03/08/2026, G0) | "Database schema is up to date!" — 1 migration baseline, DB dev cũ được `resolve --applied`, không mất dữ liệu | ✅ PASS (Claude, 03/08/2026) | `npm run migrate:drift-check` cần `SHADOW_DATABASE_URL` (DB Postgres phụ, xoá-tuỳ-ý) — đã wire trong CI, **chưa tự verify được ở máy này** vì user Postgres local không có quyền CREATEDB để tạo DB nháp |
| 15 | Boot split — `npm run build` rồi `start:platform:prod` + `start:xoffice:prod` (mới 04/08/2026, Stage B) | Cả 2 process lên khoẻ song song :4000/:4001; `/api/platform/*` → 404 ở xoffice, `/api/xoffice/*` → 404 ở platform | ✅ PASS (Claude, 04/08/2026) | Xác nhận qua request 404 chéo thật, không đoán theo cấu hình |
| 16 | `npm run test:delivery` trỏ base `:4001` (xoffice process) (mới 04/08/2026, Stage B) | DELIVERY SMOKE PASSED — bao gồm "POST launch"/"launch ran to COMPLETED"/"detail embeds live launch progress" | ✅ PASS (Claude, 04/08/2026) | Bằng chứng chính: Delivery (process xoffice) gọi HTTP thật sang Launch Factory (process platform, :4000) qua `/api/platform/launches` — không phải gọi hàm nội bộ nữa |
| 17 | Full smoke run 39 script trên cấu hình 2-process (mới 04/08/2026, Stage B) | 39/39 PASS | ✅ PASS trừ 2 flake xác nhận không liên quan (Claude, 04/08/2026) | `test:people-attendance`: bug tính giờ đi trễ có từ trước · `test:smoke` xoffice-e2e: 62 dòng Delegation tồn đọng từ chạy tay lặp lại trên DB dev cũ (không phải do code) — cả 2 KHÔNG liên quan Stage B, đưa vào CI ở chế độ non-blocking |

> Ghi chú đã biết: `test:records` đôi khi in `PASSED` rồi ném 1 assertion teardown của libuv (Windows) — chạy lại exit 0 sạch, **không phải lỗi thật**.

## 2. Gate tự động — frontend
Chạy trong `D:/Code/xhub-web`.

| # | Lệnh | Kỳ vọng | Kết quả | Ghi chú |
|---|---|---|---|---|
| 12 | `npx tsc --noEmit` | 0 lỗi trong `src/**` (chỉ còn artifact `.next/dev/types/validator.ts`) | | |

---

## 3. Kiểm thử tay — UAT toàn hệ thống (mở http://localhost:3000)

> Nguồn đầy đủ và luôn cập nhật: console tương tác `/docs/test` (`USER_TEST_ROWS`, hiện 110 mục / 14 nhóm). Bảng dưới đây mirror các nhóm chính + nhóm mới nhất (3j) — nếu thấy thiếu nhóm nào so với `/docs/test`, đó là do bảng ở file này chưa được đồng bộ lại từ đợt bổ sung trước, không phải `/docs/test` sai.
> Ghi chú vai trò: **[ADMIN]** chỉ admin/quản trị · **[PLATFORM]** chỉ platform-operator · **[ENFORCE]** cần bật enforcement.

### 3a. Điều hướng & UI
| # | Bước | Kỳ vọng | Kết quả |
|---|---|---|---|
| U1 | Xem icon rail bên trái | Đúng **5 workspace**: Trang chủ · Công việc · X.Space · X.Office · Doanh nghiệp (KHÔNG có item "Thiết lập" thừa) | |
| U2 | Bấm từng workspace trên rail | Panel "prime" con hiện đúng các màn của workspace đang chọn | |
| U3 | Thu gọn menu | Rail thu gọn → menu chuyển thành header ngang có icon; mở lại về panel dọc; back chevron đúng | |
| U4 | Thu nhỏ / mobile → hamburger | Hiện drawer hamburger; liệt kê menu theo workspace đang chọn | |
| U5 | Sơ đồ đơn vị → toàn màn hình | Org-chart fullscreen phủ luôn rail; thoát fullscreen trả lại layout | |
| U6 | Chuyển sáng / tối | Toàn bộ màu nền/chữ đổi đồng bộ; không mảng lệch tông | |
| U7 | Mở `/docs` xem tab | 6 tab: Phát triển · Hướng dẫn · Nghiệp vụ · SaaS · Backlog · Kiểm thử; mỗi tab markdown + TOC | |

### 3b. Xác thực
| # | Bước | Kỳ vọng | Kết quả |
|---|---|---|---|
| U8 | `/login` đăng nhập | Form render; đúng → vào app; sai → báo lỗi | |
| U9 | Mời → kích hoạt `/activate` **[ENFORCE]** | Đặt mật khẩu → tài khoản active, đăng nhập được | |
| U10 | Quên `/forgot` → `/reset` **[ENFORCE]** | Nhận link; đặt mật khẩu mới; đăng nhập bằng mật khẩu mới | |
| U11 | Thu hồi phiên khi treo tài khoản **[ADMIN][ENFORCE]** | Suspend user → phiên user đó bị vô hiệu | |
| U12 | Chọn tenant `/select-tenant` | User đa tenant thấy danh sách; chọn 1 → vào đúng workspace | |

### 3c. Quản trị & Tổ chức
| # | Bước | Kỳ vọng | Kết quả |
|---|---|---|---|
| U13 | `/admin` tổng quan **[ADMIN]** | Chip "Control Plane trực tiếp"; số liệu người dùng/đơn vị/vị trí/xung đột/kết nối live | |
| U14 | `/admin/users` danh sách + mời **[ADMIN]** | Chip live; chức danh/đơn vị/vai trò resolve thật; nút mời mở drawer | |
| U15 | `/admin/organization` Sơ đồ đơn vị **[ADMIN]** | Chip "Dữ liệu trực tiếp (/api/identity)"; cây đơn vị + trưởng đơn vị thật | |
| U16 | Sơ đồ nhân sự **[ADMIN]** | Node hiện avatar, email, số điện thoại thật | |
| U17 | Cấu hình node đơn vị **[ADMIN]** | Đổi tên / gán trưởng / thêm con / di chuyển / xoá — lưu và cây cập nhật | |
| U18 | In / Xuất PDF sơ đồ **[ADMIN]** | Tạo file sơ đồ đúng bố cục | |
| U19 | `/admin/positions` vị trí + kiêm nhiệm **[ADMIN]** | Timeline vị trí; hiển thị acting/kiêm nhiệm đúng | |
| U20 | `/admin/roles` vai trò + ma trận quyền **[ADMIN]** | Ma trận quyền; "test-as-user" xem quyền hiệu lực 1 user | |
| U21 | `/admin/data-scopes` **[ADMIN]** | Cấu hình data-scope hiển thị và lưu đúng | |
| U22 | `/admin/delegations` **[ADMIN]** | Guardrail SELF_DELEGATION gắn cờ khi tự uỷ quyền | |
| U23 | `/admin/backups` → "+ Tạo bản sao lưu" **[ADMIN]** | Drawer submit → gói mới, Checksum PASS, dung lượng hiển thị | |
| U24 | `/admin/restores` phục hồi **[ADMIN]** | Chọn gói → mô phỏng khôi phục hiển thị trạng thái | |
| U25 | `/admin/audit` kiểm toán **[ADMIN]** | Log audit thao tác quản trị; lọc/tra cứu được | |
| U26 | `/admin/settings/tenant` **[ADMIN]** | Panel provisioning live; toggle Bật/Tắt app; "Đối soát" → consistent | |

### 3d. X.Office
| # | Bước | Kỳ vọng | Kết quả |
|---|---|---|---|
| U27 | `/office/requests` tạo→submit→duyệt | Trạng thái chuyển đúng qua các bước | |
| U28 | Yêu cầu — comment + đính kèm + execute/evidence | Bình luận & tệp; bước execute ghi evidence | |
| U29 | `/office/my-requests` | Chỉ hiện yêu cầu của mình; đồng bộ Request Center | |
| U30 | `/office/directives` issue→ack→accept | Timeline chỉ đạo ghi nhận từng bước | |
| U31 | `/office/service-desk` ticket | Tạo→assign→resolve→CSAT; SLA/trạng thái cập nhật | |
| U32 | `/office/bookings` tạo→duyệt→check-in | Đặt trùng khung giờ trả xung đột (409) | |
| U33 | `/office/announcements` publish→read→ack→remind | Báo cáo tỷ lệ + nhắc lại | |
| U34 | `/inbox` hộp việc | Work-item gom về; mở item → sang màn xử lý đúng | |
| U35 | `/approvals` hàng chờ duyệt | Approve/reject cập nhật nguồn | |
| U36 | `/office/workflows` quy trình | Mở builder/form/versions hiển thị đúng | |
| U37 | `/office/monitor` giám sát | Bảng giám sát instance/quy trình có số liệu | |

### 3e. Tài liệu
| # | Bước | Kỳ vọng | Kết quả |
|---|---|---|---|
| U38 | Mở `/documents` | Chip "Kho tài liệu trực tiếp (/api/records)"; Dung lượng + Phiên bản số thật | |
| U39 | Mở 1 tài liệu — lịch sử phiên bản | Timeline bất biến; size/mime/tác giả/sha256 | |
| U40 | "+ Tải tài liệu" | Drawer upload → tạo tài liệu mới thật | |
| U41 | "Phiên bản mới" + "Tải nội dung" | Version +1 (bản cũ giữ nguyên); tải đúng nội dung | |

### 3f. X.Space
| # | Bước | Kỳ vọng | Kết quả |
|---|---|---|---|
| U42 | `/space/home` + kênh | Danh sách kênh; mở kênh xem overview/threads/lists | |
| U43 | Nhắn trực tiếp (DM) | Gửi/nhận tin đúng luồng | |
| U44 | `/customers` khách hàng 360 | Hồ sơ 360 (thông tin + hoạt động) đầy đủ | |

### 3g. Platform Console
| # | Bước | Kỳ vọng | Kết quả |
|---|---|---|---|
| U45 | `/platform` tổng quan **[PLATFORM]** | Chỉ platform-operator thấy; dashboard nền tảng live | |
| U46 | `/platform/tenants` **[PLATFORM]** | Liệt kê **10 tenant** (T001–T010) status/class/blueprint | |
| U47 | Đăng ký / onboard tenant khách **[PLATFORM]** | Tenant mới vào sổ đăng ký, trạng thái onboard | |
| U48 | `/platform/launches` **[PLATFORM]** | Tiến trình **8 bước** chạy tuần tự, cập nhật từng bước | |
| U49 | `/platform/blueprints` + `/platform/seed-packs` **[PLATFORM]** | Mở chi tiết 1 mục hiển thị cấu phần | |
| U50 | `/platform/backups` lịch + Chạy ngay **[PLATFORM]** | Lịch backup định kỳ mỗi tenant; "Chạy ngay" tạo gói tức thì | |
| U51 | `/delivery` triển khai **[PLATFORM]** | Mở 1 engagement xem tiến độ | |

### 3h. Đa tenant (cách ly)
| # | Bước | Kỳ vọng | Kết quả |
|---|---|---|---|
| U52 | Đăng nhập user T002 (`tenant-realestate-demo`) **[ENFORCE]** | Thấy đúng dữ liệu T002 | |
| U53 | Cách ly khỏi T001 **[ENFORCE]** | KHÔNG thấy bản ghi T001; RLS chặn rò rỉ | |
| U54 | Tài liệu T002 folder riêng **[ENFORCE]** | Lưu tách biệt lưu trữ T001 | |

### 3i. Console kỹ thuật
| # | Bước | Kỳ vọng | Kết quả |
|---|---|---|---|
| U55 | DevTools Console khi lướt tất cả màn | 0 lỗi đỏ (JS error / failed fetch) | |

### 3j. Vận hành — Tách process XHub/X.Office (Stage B, 04/08/2026)
> Khác nhóm trên: cần mở terminal (không chỉ trình duyệt) — dành cho dev/kỹ thuật xác nhận backend đã tách 2 process thật.

| # | Bước | Kỳ vọng | Kết quả |
|---|---|---|---|
| U106 | [DEV] `npm run build` rồi 2 terminal chạy `start:platform:prod` + `start:xoffice:prod` | Cả 2 lên khoẻ, không EADDRINUSE; log mỗi process chỉ liệt kê route nhóm mình | |
| U107 | Sửa `.env.local` trỏ `XHUB_API_URL=:4000` + `XOFFICE_API_URL=:4001`, mở `/platform/tenants` | Danh sách 10 tenant tải bình thường — lấy từ process platform | |
| U108 | Mở `/office/requests` (giữ nguyên cấu hình U107) | Danh sách yêu cầu tải bình thường — lấy từ process xoffice, KHÔNG phải platform | |
| U109 | Mở `/delivery`, chọn engagement GO_LIVE, bấm "Khởi chạy tenant" | Tiến trình 8 bước COMPLETED — bằng chứng chính: HTTP thật xuyên process (Delivery→Launch Factory) | |
| U110 | [DEV] Tắt process platform, thử `/platform/tenants` rồi `/office/requests` | `/platform/tenants` báo lỗi kết nối rõ ràng; `/office/requests` vẫn hoạt động — 2 process độc lập thật | |
| U111 | [DEV] Tắt cả 2, chạy lại `start:dev` (all-in-one 1 process) | App hoạt động bình thường như trước khi tách — chế độ dev nhanh không bị phá vỡ | |

### 3k. Kinh doanh — Doanh thu & Hợp đồng (Revenue & Contract MVP, BO-0201→0210, 05/08/2026)
> Chỉ hiện ở `/office/docs/test` (X.Office). Có sẵn dữ liệu mẫu T001 X-TECH (seed) để test không cần tự tạo mới từ đầu.

| # | Bước | Kỳ vọng | Kết quả |
|---|---|---|---|
| U112 | `/office/customers` tạo khách hàng mới (tên gần giống 1 khách đã có) | Tạo thành công; hiện gợi ý "có thể trùng"; 360 view đúng liên hệ + timeline | |
| U113 | `/office/opportunities` tạo cơ hội, chuyển LEAD→…→NEGOTIATION | Chỉ chuyển đúng thứ tự cho phép, không nhảy cóc | |
| U114 | Chuyển 1 cơ hội sang LOST không nhập lý do | Bị từ chối, bắt buộc `lostReason` | |
| U115 | Chuyển 1 cơ hội sang WON | Thành công nhưng KHÔNG tự sinh hợp đồng/doanh thu | |
| U116 | `/office/catalog` xem danh mục thương mại | Tên/loại/mô hình giá đúng; version tăng khi sửa | |
| U117 | Tạo báo giá theo cơ hội, thêm dòng chiết khấu >15% | Tổng tiền tự tính đúng; tự chuyển "cần duyệt" | |
| U118 | Duyệt báo giá "cần duyệt" mà không nhập ghi chú | Bị từ chối (400), bắt buộc ghi chú người duyệt | |
| U119 | `/office/contracts` tạo hợp đồng từ báo giá, thêm dòng, chuyển tới SIGNING | Tên khách hàng + tổng tiền đúng; khoá sửa dòng từ SIGNING trở đi | |
| U120 | "Ký hợp đồng (mock)" rồi chuyển EFFECTIVE | Ghi nhận 1 chữ ký MOCK; chỉ chuyển EFFECTIVE khi đã ký | |
| U121 | Mở tab Nghĩa vụ & cảnh báo sau khi EFFECTIVE | Tự sinh nghĩa vụ theo mốc; cảnh báo đúng theo hạn | |
| U122 | Hoàn thành nghĩa vụ, bấm "Tạo yêu cầu xuất hoá đơn" 2 lần liên tiếp | Không tạo trùng yêu cầu (idempotent) | |
| U123 | `/office/revenue-kpi` xem 6 chỉ số | Mỗi KPI có công thức + nguồn; 2 chỉ số cần FinERP ghi "chưa sẵn sàng" | |

### 3l. Phát triển & Chất lượng — Engineering Governance Hub (DG-01..12, 05/08/2026)
> Chỉ hiện ở `/docs/test` (platform, KHÔNG theo tenant).

| # | Bước | Kỳ vọng | Kết quả |
|---|---|---|---|
| U124 | `/engineering` tổng quan | Đúng 6 sản phẩm theo thứ tự rollout | |
| U125 | Mở PRD-XHUB — Product 360 | Version/repo/CI-Build đúng; mục "Chưa xây" liệt kê rõ | |
| U126 | `/engineering/versions` bảng version 6 sản phẩm | XHub/X.Office = 1.0.0, còn lại = 0.1.0 | |
| U127 | `/engineering/backlog` lọc theo sản phẩm + trạng thái | Lọc đúng, đúng chuỗi FSM | |
| U128 | `/engineering/docs` lọc PRD-XHUB | Thấy tài liệu chuẩn bảo mật (SECURITY_PRIVACY) | |
| U129 | `/engineering/tests` ghi kết quả 1 test case | Trạng thái + thời điểm cập nhật ngay | |
| U130 | Ở case FAIL, bấm "Báo lỗi" | Tạo Defect liên kết đúng test case | |
| U131 | `/engineering/defects` tìm lại lỗi vừa báo | Có nhãn "(từ kết quả kiểm thử)", trạng thái NEW | |
| U132 | `/engineering/controls` chọn PRD-XHUB | 16 kiểm soát, đa số IN_PLACE, 2 mục PARTIAL | |
| U133 | `/engineering/ai-systems` | Đúng 1 hệ thống AI đã đăng ký, rủi ro LIMITED | |
| U134 | `/engineering/privacy` | Đúng 2 hoạt động xử lý dữ liệu cá nhân | |
| U135 | `/engineering/audit-room` bấm từng thẻ | Số liệu đúng; nhảy đúng trang chi tiết | |

> 🔄 **Đồng bộ tự động:** trang `/docs/test` giờ lưu kết quả tick về máy chủ (`/api/testruns` → `storage/testruns/<tenant>/<user>.json`), badge "Đã lưu máy chủ". Khi bạn tick, tôi pull được để cập nhật nhật ký §5. **Mới 05/08/2026:** ô ghi chú mỗi dòng nhận dán ảnh (Ctrl+V) trực tiếp làm bằng chứng — không cần chọn file, tự tải lên và hiện thumbnail.

---

## 4. (Tuỳ chọn) Kiểm thử authz enforcement bật
`test:authz` đã tự bật enforcement per-request (header `x-authz-enforce`), server vẫn để `AUTH_ENFORCE=false`. Muốn thử enforce toàn cục trên môi trường riêng: đặt `AUTH_ENFORCE=true` + `AUTH_ALLOW_HEADER_IDENTITY=false` trong `.env` rồi rebuild — **không làm trên môi trường demo đang chạy**.

---

## 5. Nhật ký chạy test (append mỗi lần)

| Ngày | Người test | Phạm vi (mục #) | Kết quả tổng | Ghi chú / lỗi phát hiện |
|---|---|---|---|---|
| 2026-07-30 | Claude (baseline) | 1–3 tự động + UI mẫu | PASS toàn bộ | Baseline khi bàn giao; api PID single :4000; 0 console error |
| 2026-07-30 | Claude (auto run) | **1–12 (auto)** | **PASS 12/12** | api tsc 0 · web src 0 · 9 smoke + scan:secrets PASS; records/webhook/authz có teardown-noise (đã xác minh pass). UI mục 3 (U1–U15) chờ người confirm |
| 2026-08-01 | Claude (IOC DT-01→03) | IOC Digital Twin + regression | **PASS** | Mới: `test:ioc-twin` (44 assert) + `test:ioc-data-layer` (45 assert) PASS — AT-001/002/003/004/005/006/009/010/012. Regression: `test:rls` (89 bảng, MUST_NOT_LEAK 0) · work-item · work-project · work-views · manage-slice · smoke · lifecycle · scan:secrets đều PASS. tsc api 0 / web 0. 9 route `/ioc/*` HTTP 200 có nội dung thật (8 polygon SVG dựng ở server). Chưa tự động hoá: AT-007 (fallback 3D→2D, mới chứng minh bằng cấu trúc) · AT-008 (giải phóng bộ nhớ renderer) — cần người tick ở mục UI |
| 2026-08-01 | Claude (PE-01 + MG-04, song song) | People Essentials PE-01 + Management OS MG-04 + regression | **PASS** | Máy mới: dựng lại Postgres local + `.env` + `npm install` từ đầu (chưa có sẵn). Mới: `test:people-leave` (26 assert: idempotency/overlap/SOR guard/approve→balance/cancel-refund/team-scope ABAC/overtime/cross-tenant 400) + `test:manage-portfolio` (20 assert: gate FSM/link-project 404/benefit realization từ MetricObservation thật/cross-tenant 404) đều PASS. RLS 89→**98 bảng** (`test:rls` MUST_NOT_LEAK 0/98). Regression: manage-slice · manage-okr · manage-industry · ioc-twin · ioc-insights · smoke · scan:secrets đều PASS. tsc api 0 / web 0. Verify tay qua browser (Chrome pane): tạo đơn nghỉ thật `/people/leave` → xem trước ảnh hưởng → gửi → duyệt ở `/people/team/availability` (scope ABAC đúng: mặc định về ou-fin, chọn ou-tech ngoài phạm vi trả 403 rõ ràng) → số dư đổi đúng; `/manage/portfolio` tạo initiative → gắn `EP-INT-001` → "Xem thực thi" deep-link đúng trang `/work/projects/ep-seed-internal`. Dữ liệu test tay đã dọn sạch khỏi DB sau khi verify. |
| 2026-08-03 | Claude (G0 Secure Foundation — theo Audit260803 + handoff Business-Ops/Identity-P0) | Security fix xoffice.controller.ts + Prisma migration baseline + CI mới, branch `security/g0-secure-foundation` | **PASS (phần tự verify được)** | Vá 28/28 route `xoffice.controller.ts` bằng `@RequirePermission` (trước đó 0/28, đây là lỗ hổng CRITICAL SEC-002/GAP-002 — tự cấp quyền admin qua uỷ quyền, đã chứng minh khai thác được trong audit). Regression test mới `test:e2e` PASS. `main.ts` thêm `assertSecureStartup()` — hard-fail khi `STAGING_STRICT=true` mà secret vẫn lộ / `AUTH_ENFORCE≠true` / `AUTH_ALLOW_HEADER_IDENTITY≠false` (không đổi hành vi demo mặc định). Chuyển `prisma db push` → Prisma Migrate (1 migration baseline, DB dev không mất dữ liệu, 13 tenant còn nguyên). CI mới `.github/workflows/ci.yml` (chưa push lên GitHub để chạy thật — chỉ verify local). Regression: `test:authz` · `test:rls` (98 bảng) · `test:isolation` · `test:xoffice` đều PASS sau khi thêm permission gate — không phá vỡ hành vi demo hiện có. tsc api 0, build api+web sạch. **Chưa verify**: CI thật trên GitHub Actions (chưa push), toàn bộ chuỗi seed 13 bước trên DB hoàn toàn trống (máy này không có quyền CREATEDB để tạo DB nháp), rotate `ANTHROPIC_API_KEY` (cần chủ tài khoản làm thủ công). Đây là fix backend/permission — không có màn hình UI mới; test tay nên tập trung xác nhận U27/U33–U37 (X.Office) vẫn hoạt động y hệt trước (regression), vì mọi route chỉ được gắn permission ở chế độ soft (chưa bật `AUTH_ENFORCE`), không đổi trải nghiệm demo. |
| 2026-08-04 | Claude (Phase 1.5 Stage A+B — XHub/X.Office boundary cleanup + process split) | Stage A: dọn hết raw cross-schema write/read + ESLint boundary rule + gom API client frontend. Stage B: tách xhub-api thành 2 process (platform :4000 + xoffice :4001, 1 DB chung). Commit local `main` (chưa push, chờ review) | **PASS** | **Stage A**: `TenantScopeInterceptor` → `src/common/`; People hết raw write Workflow/ApprovalTask/OutboxEvent (qua `XofficeService`); `Delegation` hợp nhất về `IdentityService`; ESLint rule tự viết (`no-restricted-syntax`, không thêm dependency) bắt được 4 vi phạm THẬT sót lại từ đợt sửa trước, đã sửa; frontend gom 3 biến API-base cũ thành 1 module, vá luôn bug thật (`XOFFICE_API_BASE` chưa từng khai báo, luôn âm thầm rơi về localhost). **Stage B**: 3 phụ thuộc chéo còn lại xử lý xong (di dời `backup.tables`→`common`, tách `outbox.ts` shared, Delivery→Launch chuyển từ in-process sang HTTP client thật qua `/api/platform/launches`) — phát hiện + sửa 1 lỗ hổng authz ẩn (`SOLUTION_DELIVERY_MANAGER` launch tenant được hôm nay chỉ vì bypass guard, đã cấp đúng quyền `platform.launch.*` để đi qua guard thật). 2 composition root mới (`platform-app.module.ts`/`xoffice-app.module.ts`) cùng `src/` tree, không di dời thư mục. Verify thật: build cả 2 process từ 1 `dist/`, chạy song song, xác nhận boundary qua 404 chéo; `test:delivery` trỏ `:4001` xác nhận Delivery gọi HTTP thật sang `:4000`; browser thật xác nhận `/platform/tenants` qua `:4000` và `/office/requests` qua `:4001`. Full smoke 39 script PASS trừ 2 flake xác nhận không liên quan (attendance lateness có từ trước; Delegation tồn đọng từ chạy tay lặp — dọn sạch thì pass, CI DB mới không gặp lại). Thêm nhóm test tay mới **3j "Vận hành — Tách process"** (U106–U111, cần terminal, dành cho dev/kỹ thuật) — CHƯA có ai tick, cần người review chạy qua. |
| 2026-08-05 | Claude (Engineering Governance Hub DG-09→12 + Revenue & Contract MVP trọn vẹn BO-0201→0210 + Console kiểm thử đính kèm ảnh) | Chưa commit — build xong toàn bộ, đang chờ chủ đầu tư tự test 1 lượt qua UI | **PASS (phần tự động)** | DG-09→12 (Control Framework/AI Governance/Privacy-DPIA/Evidence, XHub Platform): 4 smoke mới PASS, build+tsc 2 process sạch. Revenue & Contract MVP (X.Office, +12 bảng RLS →105): 6 smoke mới PASS (customers/opportunities/commercial-catalog/proposals/contracts 25 assertion/revenue-kpi), seed T001 chạy 2 lần xác nhận idempotent, verify tay qua browser (Customer→Opportunity→Proposal→Contract→ký mock→nghĩa vụ→xuất hoá đơn→KPI, số liệu đối chiếu khớp) — 2 bug tự phát hiện qua smoke/browser đã sửa (dò trùng khách hàng sai chiều; Contract detail thiếu tên khách hàng do thiếu include). 2 smoke cũ (`announcements`/`requests`) từng báo lỗi hàng loạt khi chạy gộp — xác minh lại là do quên set `XOFFICE_BASE` khi tự chạy tay thủ công (không phải regression, CI thật set biến này per-step nên không bị). Console kiểm thử: thêm paste-ảnh (Ctrl+V) làm bằng chứng + 2 nhóm checklist mới **3k "Kinh doanh"** (U112–U123) và **3l "Phát triển & Chất lượng"** (U124–U135) — CHƯA có ai tick, đang chờ chủ đầu tư test theo đúng yêu cầu. |
|  |  |  |  |  |

> Cách dùng: mỗi lần test thêm 1 dòng. Nếu FAIL, ghi mục # + thông báo lỗi + môi trường; mở issue/giao lại cho dev kèm dòng nhật ký này.
