# CURRENT_RELEASE_DELTA_ANALYSIS — XHub Next Phases → X-TECH Internal Pilot

> Tài liệu phân tích khoảng cách (docs-first, KHÔNG code). Cập nhật: 2026-07-30.
> Căn cứ hiện trạng: `TINH_HINH_DU_AN_XHUB.md`, `PROJECT_STATUS_XHUB.md`, `HANDOFF_XHUB.md` + đọc trực tiếp codebase `xhub-web` / `xhub-api`.
> Căn cứ mục tiêu: bộ handoff `XTECH_XHUB_NEXT_PHASES_COMPACT_UX_SEED_HANDOFF_20260730` (`docs/00,01,02,03,10`, `data/*.csv`, `backlog/IMPLEMENTATION_BACKLOG.csv`, `tests/AUTOMATED_GATE_MATRIX.csv`).
> Tài liệu song song (cùng thư mục): `PHASE_EXECUTION_PLAN.md`, `MENU_ROUTE_DELTA_PLAN.md`, `SEED_MIGRATION_PLAN.md`, `INTERNAL_AUTH_CUTOVER_PLAN.md`, `XOFFICE_OPERATIONAL_DELTA_PLAN.md`, `DOCUMENT_MIGRATION_PLAN.md`, `X2BMS_BATCH0_DRYRUN_PLAN.md`, `BACKUP_UAT_RUNBOOK.md`.

## Cách đọc bảng
- **Đã có (file/endpoint thật):** đã verify bằng đọc file/grep — đường dẫn tuyệt đối, endpoint thật.
- **Delta cần làm:** phần thiếu để đạt "lát cắt dùng được" theo `00_EXECUTIVE_HANDOFF.md` (menu + màn live + không demo-fallback trên staging + seed + gate + UAT).
- **Rủi ro:** rủi ro chính khi thực thi delta.
- **NX-id liên quan:** id trong `backlog/IMPLEMENTATION_BACKLOG.csv`.

---

## 1. Auth / Internal Auth Production (PH-00)

| Đã có (file/endpoint thật) | Delta cần làm | Rủi ro | NX-id |
|---|---|---|---|
| Module auth: `D:\Code\xhub-api\src\auth\{auth.controller.ts,auth.service.ts,auth.module.ts}`; endpoint `POST /api/auth/login|logout`, `GET /me`, `switch-tenant`; cookie `xhub_session` httpOnly; `Membership` model (16 seed). | Trang **forgot/reset/select-tenant** thật (`AUTH-02..05`); luồng **invite/reset** kích hoạt user seed; **polish Tailux** cho auth pages. | Cutover enforce có thể khoá nhầm luồng nghiệp vụ đang dựa header identity. Xem `INTERNAL_AUTH_CUTOVER_PLAN.md`. | NX-002, NX-004 |
| `IdentityGuard` (soft) `src\auth\identity.guard.ts`; `PermissionGuard` + `@RequirePermission` `src\auth\{permission.guard.ts,require-permission.decorator.ts}`; env-gated `AUTH_ENFORCE`, `AUTH_ALLOW_HEADER_IDENTITY`. | Bật `AUTH_ENFORCE=true` + `AUTH_ALLOW_HEADER_IDENTITY=false` **trên staging**; xác nhận không route nghiệp vụ nào còn rơi về demo identity. | Nhiều controller đọc `@Identity()` với fallback header/default → khi tắt header phải chắc mọi caller có session. | NX-002 |
| **Session revoke**: chưa có endpoint revoke/suspend-terminates-session (auth module không lộ route revoke). | **Session management + revoke** khi suspend user (`NX-003`): suspend/revoke phải chấm dứt session đang mở. | Suspend không cắt session = lỗ hổng bảo mật pilot. | NX-003 |
| OIDC seam MOCK: `src\auth\oidc\` (MockOidcProvider + route login/callback, `AUTH_OIDC_*`). | **KHÔNG** nối Azure AD/Keycloak trong pilot (non-negotiable #2 của handoff CLAUDE.md). Giữ seam nguyên trạng. | Nhầm lẫn phạm vi: pilot dùng INTERNAL auth, không phải IdP thật. | — |
| Gate `test:authz` (allow/deny/401/oidc) PASS. | Chạy `test:authz` ở **profile AUTH_ENFORCE=true** (G-11 yêu cầu) mỗi phase từ PH-00. | Gate hiện chạy ở demo profile; cần profile enforce để đại diện staging. | NX-002 |

Việc chủ dự án: **rotate `ANTHROPIC_API_KEY`** (fingerprint `d9d24a2d90654ea4`, đã lộ) — NX-001, không agent làm thay.

---

## 2. Admin write-flows (Tenant Admin Live Closure — PH-01)

15 màn `/admin/*` đã LIVE-wire read qua `D:\Code\xhub-web\src\features\tenant-admin\{identity.server.ts,controlplane.server.ts,backup.server.ts}` + proxy `D:\Code\xhub-web\src\app\api\admin\*`. Delta là các **write còn demo**.

| Đã có (file/endpoint thật) | Delta cần làm | Rủi ro | NX-id |
|---|---|---|---|
| **Org write ĐÃ LIVE**: `src\identity\identity.controller.ts` → `PATCH org-units/:id` (re-parent, chống vòng lặp, RLS), `POST org-units`, `DELETE org-units/:id`, `PATCH positions/:id`. Màn `/admin/organization` drag-drop + context menu 6 hành động. | `NX-013`: **org version / effective date / acting holder** (task snapshot không đổi) — hiện PATCH ghi trực tiếp, chưa có version/hiệu lực. | Thay đổi org làm lệch snapshot phân công đã chốt nếu không version hoá. | NX-013 |
| **Invitation**: KHÔNG có endpoint (grep `invitation` trong `src\identity` = rỗng). FE FormDrawer đã dựng. | `NX-010`: **Invitation write API live** — idempotent invite + audit. | Không gửi mail thật cho tài khoản `.local` (non-negotiable #7). | NX-010 |
| **Role-binding write**: chỉ có `@Get('role-bindings')`, KHÔNG có POST/PATCH ghi. | `NX-011`: **Role binding write API** + impact preview + audit. | Ghi role sai scope → rò quyền; cần impact preview trước ghi. | NX-011 |
| **Delegation (admin/identity) write**: KHÔNG có trong `src\identity`. (Lưu ý: `src\xoffice` CÓ `GET/POST delegations` cho uỷ quyền cấp workflow — khác domain, xem Xung đột #C.) | `NX-012`: **Delegation write API (identity)** — chống loop/overlap. | Nhầm 2 loại delegation (workflow vs org/admin). | NX-012 |
| **Permission/assignment giải thích**: `POST permissions/check`, `GET permissions/effective`, `POST assignment/preview` đã có; màn `/admin/roles`, `/admin/assignment-resolver` live-read. | `NX-014` Permission matrix + **Test-as-user** (allow/deny explainable); `NX-015` **Assignment resolver UI v2** (candidates/delegation/fallback snapshot). | Giải thích quyền sai gây mất niềm tin trong UAT. | NX-014, NX-015 |
| Menu admin hiện lộ theo `permission` tĩnh trong `navigation.model.ts` (demo grants all). | `NX-016`: **Menu registry role visibility** — lọc theo permission evaluator, một nguồn menu. Xem `MENU_ROUTE_DELTA_PLAN.md`. | Trùng menu / lộ mục không có quyền. | NX-016 |

---

## 3. XOffice ops (XOffice Nghiệp vụ Vận hành — PH-02)

Engine đã đủ (assignment, delegation, SLA, condition AST, parallel, subflow, idempotency). Delta là **6 nghiệp vụ văn phòng chạy độc lập** + gỡ demo-fallback.

| Đã có (file/endpoint thật) | Delta cần làm | Rủi ro | NX-id |
|---|---|---|---|
| `src\xoffice\xoffice.controller.ts`: `POST workflows/:code/requests`, `GET tasks`, `GET work-items` + `POST work-items/rebuild` (projection rebuildable, không dual-write), `POST tasks/:id/act`, `GET instances`. FE `/inbox` đọc `GET /api/xoffice/work-items` live. | `NX-020`: **Request Center + My Requests** (`/office/requests`, `/requests`) live, **không demo fallback trên staging**. | Còn merge seed non-approval ở `/inbox` để đa dạng → phải tắt trên staging (gate "không critical demo fallback"). | NX-020 |
| `POST external-executions/:id/reference` + `GET external-executions` (MANUAL_TASK, KHÔNG id ERP giả). | `NX-023`: **Manual external execution + evidence** hoàn thiện UI — no fake ERP document (non-negotiable #9). | Cám dỗ sinh chứng từ ERP giả để "đủ luồng". | NX-023 |
| Notification model + `GET notifications`/`unread-count`/`read`; chuông topbar + `/notifications`. | `NX-028`: **Announcement + read acknowledgement** (audience/reminder/report) — module thông báo nội bộ mới `/office/announcements`. | Trùng khái niệm "notification" (hệ thống) vs "announcement" (nghiệp vụ). | NX-028 |
| Comments/attachments: **backend chưa có** (PROJECT_STATUS §5 "còn lại: comments/attachments backend"). | `NX-021`: **Comments/mentions/attachments** tenant-scoped + audit. | Attachment phải đi qua Records API (xem PH-03), tránh model tài liệu thứ 2. | NX-021 |
| State machine request: `POST tasks/:id/act` có act cơ bản. | `NX-022`: **Supplement/return/resubmit/withdraw/cancel** + state machine tests. | Thiếu test máy trạng thái → luồng kẹt trong UAT. | NX-022 |
| `XH-05` task detail: hiện đọc seed (PROJECT_STATUS "XH-05 task detail đọc task thật" còn nợ). | `NX-024`: **Task detail XH-05 live** từ projection/task thật. | Deep-link từ inbox tới detail seed = lệch dữ liệu. | NX-024 |
| Directive/Ticket/Booking: mới có seed/pilot workflow, **chưa thành module nghiệp vụ**. | `NX-025` Directive/Decision/Commitment; `NX-026` Internal Service Desk; `NX-027` Booking (conflict/check-in/no-show). Xem `XOFFICE_OPERATIONAL_DELTA_PLAN.md`. | 3 module lớn (21+21+13 SP) — rủi ro tiến độ cao nhất của pilot. | NX-025..027 |
| Seed vận hành: `handoff/.../seed/{directives,tickets,bookings,announcements,xoffice_requests}.seed.json`. | `NX-029`: **Seed operational data + accounts** (manifest counts + isolation marker). Xem `SEED_MIGRATION_PLAN.md`. | Seed thiếu status/role → UAT không phủ. | NX-029 |

---

## 4. Documents / Projects / MDM (Records, Documents, Projects Live — PH-03)

| Đã có (file/endpoint thật) | Delta cần làm | Rủi ro | NX-id |
|---|---|---|---|
| **Documents LIVE**: `src\records\records.controller.ts` (`@Controller('api/records')`): `POST /`, `GET /` (list), `GET /:id`, `POST /:id/versions`, `GET /:id/versions/:versionNo/content`. Màn `/documents` + `/documents/[id]` live, version immutable, upload/phiên bản mới. | `NX-030` **Document contract migration plan** + `NX-031` **migrate `Document`(seed cũ) → `RecordDocument`** (giữ IDs/deep-link) + `NX-032` **màn documents thống nhất một contract**. Xem `DOCUMENT_MIGRATION_PLAN.md`. | 2 model song song (`Document` seed FE cho panel liên quan ↔ `RecordDocument`) — deep-link vỡ khi migrate. | NX-030..032 |
| **`/projects` đọc SEED** (verify: `D:\Code\xhub-web\src\app\(app)\projects\page.tsx` dùng `collection<Project>("projects")`, KHÔNG gọi MDM). | `NX-033`: **`/projects` route live từ Shared MDM** — bỏ list tĩnh/demo. | Đây là điểm lệch rõ nhất giữa handoff và code — MENU_TREE đánh dấu `existing-demo-to-live-ph3`. | NX-033 |
| **MDM đã có**: `src\mdm` → `POST import-jobs`, `POST import-jobs/:id/commit`, `GET master-records`, `GET duplicate-pairs`, `POST duplicate-pairs/:id/resolve`, `GET/PUT tenant-overlays`. Pipeline dedup no-auto-merge. | `NX-034` **X2BMS batch0 50 import dry-run** (metrics/reconciliation) + `NX-035` **duplicate review + tenant overlay** (no fuzzy auto-merge, non-negotiable #10). Seed `handoff/.../seed/mdm_projects_batch0.seed.json`. Xem `X2BMS_BATCH0_DRYRUN_PLAN.md`. | Dữ liệu 6.000 thật CHỈ nhập khi có nguồn X2BMS — batch0 synthetic không publish production. | NX-034, NX-035 |

---

## 5. Backup ops (Backup Vận hành, Restore Drill, UAT — PH-04)

| Đã có (file/endpoint thật) | Delta cần làm | Rủi ro | NX-id |
|---|---|---|---|
| **Backup/restore nền kỹ thuật đã PASS**: `src\backup` (`GET restores`, `GET :id`, `GET :id/verify`, `POST :id/restore`); manifest+checksum+watermark, AES-256-GCM, sandbox/dry-run + remap PK/FK, MUST_NOT_LEAK; màn `/admin/backups`, `/admin/restores` live. | `NX-040`: **schedule/retention/alert/quota** — biến backup thành quy trình (daily/weekly/monthly + failure alert). | Schedule job trùng/spawn nhiều server (nợ đã ghi) → giữ 1 server/cổng. | NX-040 |
| Restore hiện chạy trực tiếp (không có bước duyệt). | `NX-041`: **Restore production approval workflow** — requester **không tự duyệt** (matrix `restore.production.approve` = TENANT_ADMIN). | Restore production không duyệt = rủi ro mất dữ liệu. | NX-041 |
| Test `test:backup` (30 assertions), MUST_NOT_LEAK, `scan:secrets` PASS. | `NX-042` **sandbox restore drill X-TECH** (MUST_NOT_LEAK PASS) + `NX-043` **mở rộng UAT U1–U40** + `NX-044` **UAT run detail/evidence/signoff** (server-persisted) + `NX-045` **Pilot RC** (no P0 defect). Xem `BACKUP_UAT_RUNBOOK.md`. | UAT U1–U40 lớn hơn console `/docs/test` hiện tại (U1–U17) → cần mở rộng. | NX-042..045 |
| Console kiểm thử `/docs/test` (`src\app\(app)\docs\test\page.tsx`) persist về `POST /api/testruns` (U1–U17). | Mở rộng checklist U1–U40 + evidence/signoff. | Trùng công cụ UAT (console hiện có vs UAT scenarios handoff). | NX-043, NX-044 |

---

## 6. Menu / Seed (xuyên suốt mọi phase)

| Đã có (file/endpoint thật) | Delta cần làm | Rủi ro | NX-id |
|---|---|---|---|
| Nav model: `D:\Code\xhub-web\src\xhub\nav\navigation.model.ts` — 5 workspace (`home/work/space/office/business`), ONE tree cho rail + prime panel + mobile. | Bổ sung các mục PH-02 (calendar, requests, directives, service-desk, bookings, announcements) + **role visibility qua permission evaluator** (`NX-016`). So khớp với `data/MENU_TREE.csv`. Chi tiết ở `MENU_ROUTE_DELTA_PLAN.md`. | MENU_TREE handoff đặt tên workspace/route hơi khác code (vd `/tasks` vs `/work`, `/service-desk` vs `service_desk`). Xem Xung đột #A. | NX-016 |
| Seed hiện tại: `xhub-api/src/seed` + seeder `seed:records`. | Nạp seed packs handoff (`SEED-IDENTITY-01`, `SEED-TENANT-ADMIN-01`, `SEED-XOFFICE-OPS-01`, `SEED-RECORDS-MDM-01`, `SEED-UAT-01`); **không plaintext password, không gửi mail `.local`**. Xem `SEED_MIGRATION_PLAN.md`. | Seed plaintext/password hoặc gửi mail thật vi phạm non-negotiable #6/#7. | NX-029, NX-034 |

---

## 7. "KHÔNG ĐỤNG VÀO" (đã PASS — giữ nguyên, chỉ regression-test)

Theo `00_EXECUTIVE_HANDOFF.md` ("không xây lại năng lực đã PASS") và non-negotiable #12:

- **RLS 35 bảng** (`withTenant/withBypass`, FORCE) — `test:rls` PASS. Không sửa policy; chỉ giữ `MUST_NOT_LEAK`.
- **Shared MDM engine** (`src\mdm`) — pipeline dedup no-auto-merge; chỉ *dùng* cho PH-03, không sửa thuật toán match.
- **Backup/restore core** (`src\backup`) — checksum/AES-256-GCM/remap/sandbox đã PASS; PH-04 chỉ *bọc quy trình* (schedule/approval), không sửa core.
- **Workflow engine** (`src\xoffice`) — assignment/delegation/SLA/condition AST/parallel/subflow/idempotency đã đủ; PH-02 KHÔNG mở rộng engine nếu không phục vụ trực tiếp 6 flow.
- **Admin base 15 màn + Control Plane + Records core + Webhook/outbox + secret-scan** — đã live/PASS; chỉ thêm write còn thiếu, không dựng lại.
- **Nav 5 workspace** — giữ đúng 5 workspace cha; chỉ thêm mục con.

---

## 8. Xung đột handoff ↔ code (nêu rõ để tránh làm sai)

- **#A — Route/tên workspace lệch.** `data/MENU_TREE.csv` dùng workspace "Trang chủ" chứa cả `/inbox` (NAV-003) và route `/tasks`, `/requests`, `/service-desk`, `/bookings`, `/calendar`; code hiện có `/inbox`, `/approvals`, `/work`, `/projects` nằm ở workspace **"Công việc" (`work`)** và `/notifications` ở **home**. Cần ánh xạ, KHÔNG bê nguyên route CSV. Chi tiết & bảng ánh xạ ở `MENU_ROUTE_DELTA_PLAN.md`.
- **#B — `/projects` "existing" nhưng đọc seed.** MENU_TREE ghi `existing-demo-to-live-ph3`; code xác nhận đọc `collection("projects")` (seed), chưa nối MDM. Đây là delta PH-03 (NX-033), không phải "đã có".
- **#C — Delegation hai domain.** Baseline nói thiếu "Delegation write". Thực tế `src\xoffice` ĐÃ có `GET/POST delegations` (uỷ quyền cấp workflow/approval). Cái thiếu là **delegation cấp identity/org** cho màn `/admin/delegations` (NX-012). Đừng nhầm đã-có.
- **#D — Menu registry nguồn.** Handoff yêu cầu nguồn máy đọc `config/menu-registry.seed.json` + `data/MENU_TREE.csv`; code hiện dùng `navigation.model.ts` (TS). Cần quyết định: giữ TS làm nguồn và đồng bộ, hay sinh từ registry. Đề xuất giữ `navigation.model.ts` là ONE model (đã là nguồn chung), map role visibility vào đó (NX-016).
- **#E — "Không demo/live chip trên production".** Code hiện có chip "trực tiếp/demo" (degrade an toàn). Theo `02_MENU_...` chỉ được dùng ở staging/dev. Cần cờ để ẩn trên production/pilot.
