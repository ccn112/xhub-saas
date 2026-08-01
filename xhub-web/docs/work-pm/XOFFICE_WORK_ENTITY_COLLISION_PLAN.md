# XOFFICE_WORK — ENTITY & ROUTE COLLISION PLAN

> Giải quyết va chạm thực thể/route khi thêm engine PM (Native Work + Execution Project) **không phá vỡ**
> mã hiện có. Đã verify với `xhub-api/prisma/schema.prisma`, `xhub-api/scripts/rls-setup.mjs`,
> nav `xhub-web/src/xhub/nav/navigation.model.ts`, và các route dưới `xhub-web/src/app/(app)`.
> Đọc kèm: `XOFFICE_WORK_CURRENT_STATE_DELTA.md`, `XOFFICE_WORK_SCHEMA_PLAN.md`,
> `XOFFICE_WORK_ROUTE_MIGRATION_PLAN`, `XOFFICE_WORK_UI_PLAN`, `XOFFICE_WORK_INTEGRATION_PLAN`.

## 1. Mô hình 3 tầng "task" (không trộn lẫn)

| Tầng | Model thực tế | SoR | Vai trò | Quyết định |
|---|---|---|---|---|
| **Process-runtime** | **`ApprovalTask`** (đã có) — *handoff gọi là WorkflowTask* | X.Office Workflow Runtime | 1 việc-người trong 1 workflow instance (approve/humanTask) | **REUSE, không đổi** — không rename/drop |
| **PM entity (mới)** | **`NativeWorkItem`** (tạo mới ở W1) | X.Office Work | Đơn vị công việc bền vững: task/subtask/milestone/deliverable, có tiến độ/WBS/dependency | **ADD-NEW** |
| **Projection** | **`UnifiedWorkItem`** (đã có) | XHub projection (rebuildable) | Read-model hộp việc hợp nhất `/inbox` | **REUSE + mở rộng nguồn** (thêm NativeWorkItem làm nguồn) |

**Nguyên tắc:** `UnifiedWorkItem` **không** là aggregate PM; `ApprovalTask` **không** là task PM tổng quát
(khớp `docs/02` §"Explicit non-entities"). NativeWorkItem là aggregate PM; hai cái kia liên kết/chiếu vào nó.

## 2. Hai khái niệm "project"

| Khái niệm | Model thực tế | SoR | Quyết định |
|---|---|---|---|
| **CanonicalProject (MDM)** | **`MasterRecord(domain="PROJECT")`** (+ `SourceRecord`, `TenantMasterOverlay`) — đã có | Shared MDM | **REUSE**; "CanonicalProject" chỉ là bí danh khái niệm, KHÔNG tạo model tên đó |
| **ExecutionProject (mới)** | **`ExecutionProject`** (tạo mới ở W2) | X.Office Work | **ADD-NEW**; có `canonicalProjectId?` trỏ tới `MasterRecord.id` (link, không copy) |

## 3. Bảng quyết định cho TỪNG thực thể/route va chạm

Ký hiệu: **REUSE** (dùng lại nguyên trạng) · **ADD-NEW** (thêm mới) · **LINK** (nối bằng FK/reference, no dual-write) ·
**REDIRECT** (giữ route cũ, thêm alias/redirect). Tất cả **non-destructive**: không rename/drop bảng/route hiện có.

### 3.1 Thực thể (schema)

| Thực thể hiện có | Va chạm với | Quyết định | Cách làm |
|---|---|---|---|
| `ApprovalTask` | "WorkflowTask" / NativeWorkItem | REUSE + LINK | Giữ nguyên. Khi một humanTask cần trở thành công việc PM: tạo `NativeWorkItem` + `WorkLink{kind:WORKFLOW_TASK, refId:approvalTaskId}`. Không đụng cột `ApprovalTask`. |
| `UnifiedWorkItem` | inbox projection | REUSE + mở rộng | Thêm nhánh dựng projection từ `NativeWorkItem` (source `sourceSystem='XOFFICE_WORK'`). Bảng vốn "designed open" — không đổi schema. |
| `MasterRecord(domain=PROJECT)` | ExecutionProject | REUSE + LINK | `ExecutionProject.canonicalProjectId?` → `MasterRecord.id`. MDM vẫn là SoR master; ExecutionProject là state thực thi. |
| `Directive`/`DirectiveAssignment` | action item → work | LINK | Khi cam kết cần thành việc PM: `WorkLink{kind:DIRECTIVE, refId:directiveId}` trên NativeWorkItem. Directive vẫn authoritative cho field directive-riêng (`docs/00` §Collision C, nhưng KHÔNG cần chờ "finish PH-02b" vì đã đóng). |
| `Ticket` | ticket → work | LINK | `WorkLink{kind:TICKET}`. Ticket không tự động là WorkItem (`docs/01` core rule). |
| `Booking` | booking → work | LINK | `WorkLink{kind:BOOKING}` chỉ khi flow cần trách nhiệm/deadline/tiến độ. |
| `Announcement` | comm → work | LINK (hiếm) | `WorkLink{kind:ANNOUNCEMENT}` nếu phát sinh follow-up work. |
| `Engagement`/`EngagementEvent` | ExecutionProject(kind=IMPLEMENTATION) | LINK (reuse engine) | Xem §4. Engagement giữ vai trò pipeline bán/triển khai; ExecutionProject giữ kế hoạch thực thi. |
| `Request`/`RequestComment`/`RequestEvent` | request → work | LINK | `WorkLink{kind:REQUEST}` khi request sinh việc. |

### 3.2 Route (frontend)

| Route hiện có | Va chạm | Quyết định | Cách làm |
|---|---|---|---|
| `/projects`, `/projects/[projectId]` | MDM canonical vs PM | REUSE (→ MDM) | Định danh `/projects` là **MDM canonical project** (khi wire v0.11). PM **không** tái dùng route này. |
| `/work` ("Công việc và chỉ đạo") | điểm neo PM | REUSE + mở rộng | Giữ. PM UI treo dưới: `/work/projects` (danh mục ExecutionProject), `/work/items/[id]` (chi tiết NativeWorkItem). |
| `/tasks`, `/tasks/[id]` | handoff tưởng có | **KHÔNG hành động** | Route **không tồn tại** → không cần redirect. Nếu sau này thêm `/work/tasks` thì đó là route mới, không phải migrate. |
| `/inbox`, `/inbox/[workItemId]` | projection | REUSE | Giữ nguyên; là hộp việc hợp nhất. |
| `/approvals` | phê duyệt | REUSE | Giữ nguyên. |
| `/delivery`, `/delivery/engagements` | Solution Delivery | REUSE + LINK | Giữ; nối tới `/work/projects/[id]` khi Engagement có ExecutionProject. |

**Map UI tổng:** `/projects` → MDM canonical · PM UI → `/work/projects` + `/work/items/[id]` ·
`/tasks[/id]` → (không có; nếu cần, thêm `/work/tasks` mới + có thể redirect nội bộ). Chi tiết ở
`XOFFICE_WORK_ROUTE_MIGRATION_PLAN`.

## 4. Engagement ↔ ExecutionProject (tái dùng engine PM, KHÔNG build engine thứ 2)

Thực tế: `Engagement` (module `xhub-api/src/delivery`, FSM `engagements.fsm.ts`) đã build **trước** khi có engine PM,
owned bởi T001, GO_LIVE→`TenantLaunch`. Đây là cảnh báo cốt lõi của handoff (`docs/13` §Ordering dependency:
"Do not create a second project/task engine inside Solution Delivery").

**Quyết định (W5):**
- Thêm cột **`Engagement.executionProjectId?`** (nullable, LINK) trỏ tới `ExecutionProject.id`.
- Khi Engagement bước vào giai đoạn triển khai thực thi, tạo **`ExecutionProject{ projectKind: "IMPLEMENTATION",
  customerAccountId?, tenantLaunchId?, sourceRef? }`** và nối lại. Kế hoạch WBS/milestone/dependency/baseline của
  việc triển khai sống trong ExecutionProject + NativeWorkItem — **không** nhân bản trong Engagement.
- `Engagement` vẫn giữ pipeline thương mại (LEAD→…→LIVE) và trigger launch; **no dual-write**: chỉ tham chiếu id.
- Attachments cả hai phía vẫn reuse `RecordDocument` (subjectType tương ứng).

## 5. Guardrail di trú (khớp `docs/00` §Migration guardrails)

- Không rename/drop `ApprovalTask`, `UnifiedWorkItem`, `MasterRecord`, `Engagement`, hay bất kỳ bảng PH-02.
- Chỉ **ADD** bảng mới + cột link nullable + adapter/projection.
- Mọi bảng tenant mới (ExecutionProject, NativeWorkItem, WorkDependency, ProjectBaseline, BaselineItem,
  ProjectRoleAssignment, WorkLink…) **phải** vào `scripts/rls-setup.mjs` + `scripts/rls-test.mjs` **trước** khi bật
  feature flag (nâng 55 → 55+N bảng RLS).
- Backfill dữ liệu chỉ khi có bằng chứng ownership rõ ràng; giữ deep-link/route cũ.
- Projection `UnifiedWorkItem` phải rebuildable sau backup/restore.
