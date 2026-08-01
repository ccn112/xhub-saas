# XOFFICE_WORK — CURRENT STATE DELTA (Rebase Audit)

> Đối chiếu giả định của handoff `XHUB_XOFFICE_WORK_PROJECT_HANDOFF_V2_20260731` với **thực tế mã nguồn** tại
> `D:\Code\xhub-saas\xhub-api` (backend) và `D:\Code\xhub-saas\xhub-web` (frontend).
> Nguyên tắc: **source/code thắng handoff** khi mâu thuẫn. Mọi khẳng định dưới đây đã verify bằng đọc file.
> Ngày rebase: 2026-08-01. Tài liệu anh em: `XOFFICE_WORK_ENTITY_COLLISION_PLAN.md`, `XOFFICE_WORK_SCHEMA_PLAN.md`,
> và (do agent song song viết) `XOFFICE_WORK_ROUTE_MIGRATION_PLAN`, `XOFFICE_WORK_UI_PLAN`,
> `XOFFICE_WORK_INTEGRATION_PLAN`, `XOFFICE_WORK_TEST_PLAN`.

## 0. Kết luận nhanh (TL;DR)

Handoff (`docs/00_SOURCE_FINDINGS_AND_MIGRATION_WARNING.md`) mô tả trạng thái **đã lỗi thời**:
"current phase PH-02b", "41 RLS tables". Thực tế đã đi **xa hơn nhiều**:

- **PH-02 ĐÓNG HOÀN TOÀN (6/6 nghiệp vụ)** — không còn "đang làm PH-02b".
- **55 bảng RLS** (không phải 41). Tổng **69 model** trong `prisma/schema.prisma`.
- **SaaS v1.0 hoàn tất, 10 tenant (T001–T010) live** — handoff chưa biết lớp này tồn tại.
- **Solution Delivery đã build** dưới tên `Engagement` (FSM + GO_LIVE→launch), **CHƯA phải** `ExecutionProject`.
- `ExecutionProject` / `NativeWorkItem` / `WorkDependency` / `WorkflowTask` **CHƯA có model nào** trong schema.

➡️ **Hệ quả cho kế hoạch:** bước "Finish current XOffice operational (PH-02b→f)" trong
`docs/13_IMPLEMENTATION_PHASES.md` và `data/PHASE_CATALOG.csv` (dòng `PH-02b-f`) **đã xong — BỎ QUA**.
Sau khi rebase (W-R0) đi thẳng vào **W1 — Native Work Core**.

## 1. Bảng đối chiếu năng lực (capability | handoff giả định | thực tế trong code | hệ quả)

| Capability | Handoff giả định | Thực tế trong code | Hệ quả |
|---|---|---|---|
| Phase hiện tại | "PH-02b Directive/Commitment đang làm" (`docs/00` §current state) | PH-02 **ĐÓNG 6/6**: Request, Directive, Ticket, Booking, Announcement, Records-attachment (`DEV_BACKLOG.md` v0.10.0 "ĐÓNG") | Bỏ toàn bộ PH-02b→f; không "finish operational first" nữa |
| Số bảng RLS | "Latest-known 41 RLS tables" | **55 bảng** trong `xhub-api/scripts/rls-setup.mjs` (`TENANT_TABLES`, `.length` = 55) | Mọi bảng Work mới cộng THÊM vào 55, không phải 41 |
| Tổng số model | (không nêu) | **69 model** (`grep -c "^model" schema.prisma`) | Nền dữ liệu lớn hơn nhiều handoff hình dung |
| Request/Approval | PH-02a CLOSED | ✅ `Request`/`RequestComment`/`RequestEvent`, FSM đầy đủ, 42 seed, `test:requests` PASS | Đúng — đã đóng |
| Directive/Commitment | "đang implement" (PH-02b) | ✅ ĐÓNG: `Directive`/`DirectiveAssignment`/`DirectiveEvent`, FSM 2 tầng + SLA | KHÔNG cần "finish Directive lifecycle first" như `docs/00` §Collision C dặn |
| Service Desk / Ticket | PH-02c (chưa làm) | ✅ ĐÓNG: `ServiceCatalogItem`/`Ticket`/`TicketEvent`, SLA+CSAT | Sẵn để link vào Work |
| Booking | PH-02d (chưa làm) | ✅ ĐÓNG: `BookableResource`/`Booking`/`BookingEvent`, conflict 409 | Sẵn để link |
| Announcement | PH-02e (chưa làm) | ✅ ĐÓNG: `Announcement`/`AnnouncementReceipt`/`AnnouncementEvent` | Sẵn để link |
| Lớp SaaS đa tenant | Không đề cập | ✅ **SaaS v1.0**: Tenant Registry (`Tenant.tenantNo/tenantCode/…`), Platform Console, Launch Factory (`TenantLaunch`), Blueprint/SeedPack, 10 tenant ACTIVE | Bối cảnh mới: Work phải chạy đúng trong mô hình multi-tenant + platform plane |
| Solution Delivery WS | "ExecutionProject(kind=IMPLEMENTATION)" (`docs/13` W5) | ✅ Đã build là **`Engagement`/`EngagementEvent`** (FSM `engagements.fsm.ts`, GO_LIVE→`TenantLaunch`), owned T001 | **Không build engine PM thứ 2 trong Delivery**; sau này Engagement *link* tới ExecutionProject(kind=IMPLEMENTATION) |
| Runtime task (process) | Gọi là `WorkflowTask` | Trong code tên thật là **`ApprovalTask`** (`schema.prisma`), sinh bởi engine workflow | "WorkflowTask" của handoff = `ApprovalTask` của code. KHÔNG rename nó |
| Projection inbox | `UnifiedWorkItem` (projection) | ✅ Có `UnifiedWorkItem` model, **rebuildable**, RLS-scoped, dựng từ `ApprovalTask` open. `/inbox` `force-dynamic` đọc live SoR projection | Giữ nguyên; là read-model, KHÔNG phải aggregate PM |
| `NativeWorkItem` (PM task) | Entity trung tâm PM v2 | **CHƯA có model.** Contract `contracts/work-item.schema.json` title = "NativeWorkItem" (mới là schema giấy) | W1 phải tạo mới |
| `ExecutionProject` | Entity dự án thực thi | **CHƯA có model.** Contract `contracts/project.schema.json` title = "ExecutionProject" (schema giấy) | W2 phải tạo mới |
| `WorkDependency` / Baseline | Có trong domain v2 | **CHƯA có model** (chỉ có `contracts/work-dependency.schema.json`) | W2 tạo mới |
| MDM canonical project | `/projects` = "Shared MDM canonical projects", "`CanonicalProject`" | Thực tế là **`MasterRecord` domain=`PROJECT`** (+ `SourceRecord`, `TenantMasterOverlay`); **không có model tên `CanonicalProject`** | Dùng đúng tên `MasterRecord(domain=PROJECT)`; "CanonicalProject" chỉ là bí danh khái niệm |
| Route `/projects` | "đã dành cho MDM canonical" | Thực tế `/projects` + `/projects/[projectId]` đang là **listing từ seed** (`collection<Project>`), **CHƯA wire MDM**. `DEV_BACKLOG` v0.11 mới lên kế hoạch "/projects→MDM" | `/projects` chưa thuộc MDM thật; kế hoạch route phải tính đến việc nó đang là seed demo |
| Route `/work` | (không nêu rõ) | `/work` = màn **"Công việc và chỉ đạo"**, backed bởi **seed** (`collection<Task>`, `directive-week31`), KHÔNG phải engine PM live | Là điểm neo UI cho PM sau này, nhưng nội dung hiện tại là demo |
| Route `/tasks` `/tasks/[id]` | "Current route `/tasks/[id]` là workflow task detail" | **KHÔNG tồn tại** route `/tasks` trong `xhub-web/src/app/(app)`. Nav `work.tasks` trỏ `/work`. Chi tiết approval nằm ở `/inbox/[workItemId]` | Collision `/tasks` của handoff **không hiện hữu**; không cần redirect `/tasks`→`/work/tasks` |
| Route `/inbox` | (projection) | ✅ `/inbox` + `/inbox/[workItemId]` = projection UnifiedWorkItem (live SoR + seed bổ trợ) | Giữ nguyên |
| Route `/approvals` | "Trung tâm phê duyệt" | ✅ Tồn tại, gated `request.approve` | Giữ nguyên |

## 2. Cấu trúc workspace nav thực tế (`xhub-web/src/xhub/nav/navigation.model.ts`)

5 workspace tenant + 2 workspace đặc biệt (platform/delivery):
- **home** → `/home/executive|sales|me`, `/notifications`
- **work** (`href:/inbox`, match `/inbox /approvals /work /projects`): con = `Hộp việc hợp nhất (/inbox)`,
  `Trung tâm phê duyệt (/approvals)`, `Công việc & chỉ đạo (/work)`, `Dự án (/projects)`.
- **space** → `/space/*`
- **office** → 6 module PH-02 (`/office/requests|my-requests|directives|service-desk|bookings|announcements`)
  + workflow admin (`/office/workflows|instances|monitor`).
- **business** → customers, documents, reports, apps, admin(15 màn), docs.
- **platform** (gated `platform.tenant.read`) — Platform Console SaaS.
- **delivery** (gated `delivery.read`) — Solution Delivery: `/delivery`, `/delivery/engagements` ("Dự án triển khai").

➡️ PM UI mới sẽ nằm dưới nhánh **work** (chi tiết ở `XOFFICE_WORK_ROUTE_MIGRATION_PLAN` & `XOFFICE_WORK_UI_PLAN`).

## 3. Điều chỉnh roadmap so với handoff

| Bước handoff (`docs/13` / `PHASE_CATALOG.csv`) | Trạng thái thực | Hành động |
|---|---|---|
| `W-R0` Rebase audit | Đang làm (chính là bộ docs này) | Hoàn tất tài liệu rebase, không viết code |
| `PH-02b-f` Finish XOffice Operational | **ĐÃ XONG** | **BỎ QUA** |
| `W1` Native Work Core | Chưa có | Làm ngay sau rebase |
| `W2` Execution Project Core | Chưa có | Sau W1 |
| `W3` Management Views (List/Kanban/Gantt/Calendar) | Chưa có | Sau W2 |
| `W5` Solution Delivery integration | Engagement đã có; cần *link* chứ không build lại | Engagement → ExecutionProject(kind=IMPLEMENTATION), tái dùng engine PM |

## 4. Xung đột handoff-vs-code cần ghi nhớ (flag)

1. **"41 RLS tables"** (handoff) ❌ → **55** (code). 
2. **"current PH-02b"** ❌ → PH-02 đóng hết + SaaS v1.0.
3. **"`WorkflowTask`"** — không có model tên này; runtime task thật là **`ApprovalTask`**.
4. **"`CanonicalProject`"** — không có model tên này; canonical project là **`MasterRecord(domain=PROJECT)`**.
5. **"`/tasks/[id]` là route hiện hữu"** ❌ — route `/tasks` **không tồn tại**.
6. **"`/projects` đã là MDM canonical"** ❌ — hiện là **seed listing**, MDM-wire là việc tương lai (v0.11).
7. **"Solution Delivery sẽ dùng ExecutionProject"** — thực tế đã build `Engagement` **trước** khi có engine PM;
   phải nối ngược chứ không thay thế (tránh engine PM thứ 2 — đúng cảnh báo `docs/13` §Ordering dependency).
