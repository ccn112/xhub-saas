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

> Ghi chú đã biết: `test:records` đôi khi in `PASSED` rồi ném 1 assertion teardown của libuv (Windows) — chạy lại exit 0 sạch, **không phải lỗi thật**.

## 2. Gate tự động — frontend
Chạy trong `D:/Code/xhub-web`.

| # | Lệnh | Kỳ vọng | Kết quả | Ghi chú |
|---|---|---|---|---|
| 12 | `npx tsc --noEmit` | 0 lỗi trong `src/**` (chỉ còn artifact `.next/dev/types/validator.ts`) | | |

---

## 3. Kiểm thử tay — UAT toàn hệ thống (mở http://localhost:3000)

> Mirror 1-1 với console tương tác `/docs/test` (`USER_TEST_ROWS`). 55 mục / 9 nhóm.
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

> 🔄 **Đồng bộ tự động:** trang `/docs/test` giờ lưu kết quả tick về máy chủ (`/api/testruns` → `storage/testruns/<tenant>/<user>.json`), badge "Đã lưu máy chủ". Khi bạn tick, tôi pull được để cập nhật nhật ký §5.

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
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |

> Cách dùng: mỗi lần test thêm 1 dòng. Nếu FAIL, ghi mục # + thông báo lỗi + môi trường; mở issue/giao lại cho dev kèm dòng nhật ký này.
