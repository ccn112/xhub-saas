# MENU_ROUTE_DELTA_PLAN — Nav hiện tại ↔ MENU_TREE handoff

> Docs-first, KHÔNG code. Cập nhật: 2026-07-30.
> Nguồn code: `D:\Code\xhub-web\src\xhub\nav\navigation.model.ts` (ONE tree, 5 workspace, dùng chung rail + prime panel + mobile bottom-nav).
> Nguồn handoff: `data/MENU_TREE.csv`, `docs/02_MENU_INFORMATION_ARCHITECTURE.md`, `config/menu-registry.seed.json`, `data/ROLE_PERMISSION_MATRIX.csv`, `data/ROLE_CATALOG.csv`.
> Đọc kèm: `CURRENT_RELEASE_DELTA_ANALYSIS.md` (#A, #D, #E), `PHASE_EXECUTION_PLAN.md`.

## Quy tắc bắt buộc (giữ nguyên)
- **Giữ đúng 5 workspace cha** (`home` Trang chủ · `work` Công việc · `space` X.Space · `office` X.Office · `business` Doanh nghiệp). MENU_TREE gộp một số mục vào "Trang chủ" mà code để ở "Công việc" — **giữ IA code**, ánh xạ tên, không tăng số workspace.
- **Mọi trang mới PHẢI vào nav menu/submenu** (không khai menu cục bộ trong page — `02_MENU...`, `03_SCREEN_CLOSURE_RULES`).
- **Một route = một mục menu chính**; không route trùng.
- **Role visibility lấy từ permission evaluator** (không hardcode grant-all) — `NX-016`.
- **Không demo/live chip trên production**; chỉ staging/dev (xung đột #E).
- ONE model `navigation.model.ts` là nguồn (đồng bộ ý niệm với `menu-registry.seed.json`; không sinh menu song song — xung đột #D).

## Ánh xạ workspace (handoff → code)
| MENU_TREE "Workspace" | Workspace code | Ghi chú |
|---|---|---|
| Trang chủ | `home` | Code home = executive/sales/me + notifications. MENU_TREE nhét `/inbox`,`/tasks`,`/calendar` vào "Trang chủ" → **ánh xạ về `work`** trừ Thông báo. |
| Công việc | `work` | Code: inbox/approvals/work/projects. |
| X.Space | `space` | Khớp. |
| X.Office | `office` | Khớp. |
| Doanh nghiệp | `business` | Code gộp customers/documents/reports/apps/admin/docs. MENU_TREE tách admin thành nhiều submenu (`master-data`,`applications`,`users`,`roles`,`backups`,`audit`) — code đang gom trong nhóm `admin.console`. |

---

## Bảng delta menu (MENU_TREE.csv ↔ nav code)

Cột "đã có?": **existing** = có trong `navigation.model.ts`; **mới** = phải thêm; **đổi route** = có nhưng route/id khác.

| MENU_TREE | Route (handoff) | Route code hiện tại | đã có?/mới | Workspace/submenu đặt vào | Role visibility (permission) | Phase |
|---|---|---|---|---|---|---|
| NAV-001 Trang chủ | `/` | `/home/executive` | existing (đổi route) | home (rail) | ALL · `home.view` | có |
| NAV-002 Của tôi | `/my` | `/home/me` | existing (đổi route) | home › của tôi | ALL | có |
| NAV-003 Hộp việc | `/inbox` | `/inbox` | existing-live | **work** › hộp việc | ALL | có |
| NAV-004 Thông báo | `/notifications` | `/notifications` | existing-live | home › thông báo | ALL | có |
| NAV-005 Lịch của tôi | `/calendar` | — | **mới** | work (hoặc home) › lịch | ALL · booking/task due | **PH-02** |
| NAV-010 Công việc | `/tasks` | `/work` | existing (đổi route) | work (rail) | ALL · `work.view` | có |
| NAV-011 Việc được giao | `/tasks` | `/work` | existing (refactor) | work › việc được giao | ALL (`task.self`) | PH-02 (live) |
| NAV-012 Phê duyệt | `/approvals` | `/approvals` | existing | work › phê duyệt | **APPROVER** (`request.approve`) | có |
| NAV-013 Yêu cầu của tôi | `/requests` | — | **mới** | work › yêu cầu của tôi | ALL (`request.create`) | **PH-02** |
| NAV-014 Chỉ đạo & cam kết | `/directives` | — | **mới** | work › chỉ đạo | **MANAGER/DEPARTMENT_HEAD** (`directive.*`) | **PH-02** |
| NAV-015 Ticket nội bộ | `/service-desk` | — | **mới** | work › ticket | ALL (agent: `ticket.*`) | **PH-02** |
| NAV-016 Đặt phòng | `/bookings` | — | **mới** | work › đặt phòng | ALL | **PH-02** |
| NAV-017 Dự án | `/projects` | `/projects` | **existing nhưng SEED → live** | work › dự án | ALL | **PH-03** (NX-033) |
| NAV-020 X.Space | `/space` | `/space/home` | existing (đổi route) | space (rail) | ALL · `space.access` | có |
| NAV-021 Kênh | `/space/channels` | `/space/channels/...` | existing | space › kênh | ALL | có |
| NAV-022 DM | `/space/dms` | `/space/dm/...` | existing (đổi route) | space › DM | ALL | có |
| NAV-023 Danh sách | `/space/lists` | — | **mới/placeholder** | space › danh sách | ALL | (space đã có màn?) kiểm tra route |
| NAV-024 Huddle | `/space/huddles` | — | **mới/placeholder** | space › huddle | ALL | — |
| NAV-025 Workflow trong kênh | `/space/workflows` | — | **mới/placeholder** | space › workflow | ALL | — |
| NAV-030 X.Office | `/office` | `/office/workflows` | existing (đổi route) | office (rail) | ALL · `office.view` | có |
| NAV-031 Trung tâm yêu cầu | `/office/requests` | — | **mới** | office › trung tâm yêu cầu | ALL | **PH-02** |
| NAV-032 Quy trình | `/office/workflows` | `/office/workflows` | existing-live | office › quy trình | **WORKFLOW_ADMIN** (`workflow.*`) | có |
| NAV-033 Biểu mẫu | `/office/forms` | — (endpoint `/api/xoffice/forms` có) | **mới (màn)** | office › biểu mẫu | WORKFLOW_ADMIN (`form.*`) | PH-02 |
| NAV-034 Giám sát vận hành | `/office/runtime` | `/office/monitor` | existing (đổi route) | office › giám sát | WORKFLOW_ADMIN | có |
| NAV-035 Thông báo nội bộ | `/office/announcements` | — | **mới** | office › thông báo nội bộ | **COMM_ADMIN** (`announcement.*`) | **PH-02** |
| NAV-036 Danh mục thủ tục | `/office/catalog` | — | **mới** | office › danh mục thủ tục | WORKFLOW_ADMIN | PH-02 (refine) |
| — Vận hành (Instances) | — | `/office/instances` | **existing (không có trong MENU_TREE)** | office › instances | WORKFLOW_ADMIN | giữ (bổ sung vào registry) |
| NAV-040 Doanh nghiệp | `/customers` | `/customers` | existing | business (rail) | ALL/`customer.view` | có |
| NAV-041 Khách hàng | `/customers` | `/customers` | existing | business › khách hàng | **SALES** | có |
| NAV-042 Tài liệu | `/documents` | `/documents` | existing-live (refactor PH-3) | business › tài liệu | ALL | có / PH-03 |
| NAV-043 Báo cáo | `/reports` | `/reports` | existing | business › báo cáo | **MANAGER** | có |
| NAV-044 Dữ liệu dùng chung | `/admin/master-data` | — (endpoint `/api/mdm/*` có) | **mới (màn)** | business › dữ liệu dùng chung | **DATA_STEWARD** (`mdm.*`) | PH-03 |
| NAV-045 Ứng dụng & đồng bộ | `/admin/applications` | `/apps` + control-plane | **đổi route/hợp nhất** | business › ứng dụng | **TENANT_ADMIN** | PH-01 |
| NAV-046 Người dùng & tổ chức | `/admin/users` | `/admin/users`,`/admin/organization` | existing-live (refine PH-1) | business › admin › người dùng | **TENANT_ADMIN** (`admin.users`) | PH-01 |
| NAV-047 Vai trò & phân quyền | `/admin/roles` | `/admin/roles` | existing-live (refine PH-1) | business › admin › vai trò | **SECURITY_ADMIN** (`role.*`) | PH-01 |
| NAV-048 Backup & khôi phục | `/admin/backups` | `/admin/backups`,`/admin/restores` | existing-live (refine PH-4) | business › admin › backup | **BACKUP_ADMIN** (`backup.*`) | PH-04 |
| NAV-049 Kiểm toán | `/admin/audit` | `/admin/audit` | existing-live | business › admin › kiểm toán | **AUDITOR** (`audit.read`) | có |
| NAV-050 Tài liệu & kiểm thử | `/docs` | `/docs` | existing | business › tài liệu & kiểm thử | ALL | có |
| — Vị trí & người giữ | — | `/admin/positions` | **existing (không có trong MENU_TREE)** | admin › vị trí | ORG_ADMIN | giữ (PH-01) |
| — Phạm vi dữ liệu | — | `/admin/data-scopes` | **existing** | admin › phạm vi | SECURITY_ADMIN (`scope.*`) | giữ (PH-01) |
| — Uỷ quyền | — | `/admin/delegations` | **existing (demo → live)** | admin › uỷ quyền | ORG_ADMIN (`delegation.*`) | PH-01 (NX-012) |
| — Kiểm tra phân công | — | `/admin/assignment-resolver` | **existing** | admin › phân công | ORG_ADMIN/WORKFLOW_ADMIN | PH-01 (NX-015) |
| — Cấu hình tenant | — | `/admin/settings/tenant` | **existing** | admin › cấu hình tenant | TENANT_ADMIN | giữ |

---

## Nav additions cụ thể theo phase

**PH-01 (menu role visibility — NX-016):**
- Thay `permission` tĩnh (demo grants all) bằng lọc theo **permission evaluator** (`POST /api/identity/permissions/check` / `permissions/effective`). Mỗi mục mang permission theo `ROLE_PERMISSION_MATRIX`.
- Hợp nhất/đổi route admin: cân nhắc gắn `/apps` → nghĩa "Ứng dụng & đồng bộ" (NAV-045, control-plane, TENANT_ADMIN).
- Không thêm màn admin mới (PH-01 chỉ đóng write còn demo).

**PH-02 (thêm submenu nghiệp vụ):**
- workspace `work`: **+ `/requests`** (Yêu cầu của tôi), **+ `/directives`** (Chỉ đạo & cam kết — MANAGER), **+ `/service-desk`** (Ticket), **+ `/bookings`** (Đặt phòng), **+ `/calendar`** (Lịch).
- workspace `office`: **+ `/office/requests`** (Trung tâm yêu cầu), **+ `/office/forms`** (Biểu mẫu — WORKFLOW_ADMIN), **+ `/office/announcements`** (COMM_ADMIN), **+ `/office/catalog`** (Danh mục thủ tục). Giữ `/office/instances` (đưa vào registry).
- Các mục "chưa live" chỉ hiện khi **feature flag bật** (`02_MENU...`).

**PH-03:**
- `/projects` chuyển nguồn seed→MDM (không đổi vị trí menu; NX-033).
- workspace `business`: **+ `/admin/master-data`** (Dữ liệu dùng chung — DATA_STEWARD).
- `/documents` giữ vị trí, hợp nhất contract.

**PH-04:**
- Backup submenu giữ nguyên vị trí; thêm trạng thái schedule/approval trong màn (không thêm route mới).

---

## Cách tiếp cận role-based visibility (menu filtered by permission)
1. **Một nguồn menu** (`navigation.model.ts`) — mỗi item khai `permission` (và `entitlement` nếu cần) theo `ROLE_PERMISSION_MATRIX.csv`.
2. Khi render rail/prime/mobile: gọi **permission evaluator** (`permissions/effective` cho user hiện tại) → **lọc item** trước khi vào DOM (item không đủ quyền không render — đúng quy tắc "chỉ item map route thật + có quyền mới tới DOM").
3. **Demo grants all chỉ ở dev**; staging/pilot bật enforce (khớp PH-00 `AUTH_ENFORCE=true`).
4. **Mobile** chỉ hiện tác vụ chính (không copy toàn desktop tree) — subset của cùng model.
5. Ánh xạ role → permission theo `ROLE_CATALOG.csv` (vd APPROVER≈EXECUTIVE/CFO/DEPARTMENT_HEAD cho `request.approve`; MANAGER≈DEPARTMENT_HEAD cho directive; WORKFLOW_ADMIN cho office/*; TENANT_ADMIN/SECURITY_ADMIN/BACKUP_ADMIN/AUDITOR/DATA_STEWARD cho các mục admin tương ứng).

## Xung đột cần lưu (chi tiết ở CURRENT_RELEASE_DELTA_ANALYSIS #A/#D)
- Route lệch tên (`/tasks`↔`/work`, `/office/runtime`↔`/office/monitor`, `/space/dms`↔`/space/dm`, `/`↔`/home/executive`): thống nhất một route chính, redirect route cũ nếu cần, cập nhật cả model + registry.
- `/office/instances`, `/admin/positions`, `/admin/data-scopes`, `/admin/assignment-resolver`, `/admin/settings/tenant` **có trong code nhưng thiếu trong MENU_TREE.csv** → bổ sung vào registry để "một nguồn menu" đầy đủ.
- MENU_TREE thiếu cụm `/docs` con (developer/user/test) mà code có — giữ code.
