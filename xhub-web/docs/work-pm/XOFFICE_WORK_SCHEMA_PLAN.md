# XOFFICE_WORK — SCHEMA PLAN (Native Work + Execution Project)

> Thiết kế các bảng **tenant-scoped (RLS + FORCE)** mới cho engine PM, bám theo `docs/02_DOMAIN_MODEL.md` và các
> contract `contracts/{work-item,project,work-dependency,external-work-link}.schema.json`, đối chiếu với schema thực
> `xhub-api/prisma/schema.prisma` (69 model, 55 bảng RLS hiện tại). **Docs-only** — không sinh migration ở bước này.
> Đọc kèm: `XOFFICE_WORK_ENTITY_COLLISION_PLAN.md`, `XOFFICE_WORK_CURRENT_STATE_DELTA.md`,
> `XOFFICE_WORK_INTEGRATION_PLAN`, `XOFFICE_WORK_TEST_PLAN`, `XOFFICE_WORK_UI_PLAN`.

## 0. Quy ước chung (bám pattern đang dùng trong repo)

- Mọi bảng dưới đây **tenant-scoped**: có `tenantId`, thêm vào `scripts/rls-setup.mjs` (`TENANT_TABLES`) +
  `scripts/rls-test.mjs` → nâng **55 → 55+N**. RLS **FORCE** như mọi bảng nghiệp vụ hiện tại.
- Không FK cross-module cứng khi cần portability (theo tiền lệ `Delegation`/`CommandLog`); FK nội bộ trong cùng
  aggregate thì giữ (như `Directive`→`DirectiveAssignment`).
- `id` = `cuid()`. Tiền tệ (nếu có) = **số nguyên VND** (chuẩn đã chốt của dự án).
- Timeline/audit tách bảng `*Event` append-only (đồng nhất với Request/Directive/Ticket/Booking/Announcement).

## 1. `ExecutionProject` (W2) — bám `contracts/project.schema.json` (title "ExecutionProject") + `docs/02`

```
model ExecutionProject {
  id                    String   @id @default(cuid())
  tenantId              String
  code                  String                 // human code, unique per tenant
  name                  String
  description           String?
  projectKind           String   @default("INTERNAL") // INTERNAL|IMPLEMENTATION|PRODUCT|CUSTOMER_SUCCESS|OPERATIONS|OTHER
  status                String   @default("DRAFT")     // DRAFT|PLANNED|ACTIVE|ON_HOLD|AT_RISK|COMPLETED|CANCELLED
  health                String   @default("UNKNOWN")   // GREEN|YELLOW|RED|UNKNOWN
  progressMethod        String   @default("WEIGHTED")  // WEIGHTED|COUNT|MANUAL|MILESTONE
  plannedStart DateTime?  plannedFinish DateTime?
  forecastStart DateTime? forecastFinish DateTime?
  actualStart DateTime?   actualFinish DateTime?
  ownerId String?  projectManagerId String?  sponsorId String?
  orgUnitId String?
  canonicalProjectId String?  // → MasterRecord(domain=PROJECT).id  (MDM link, no copy)
  customerAccountId String?  tenantLaunchId String?  sourceRef Json?  // Solution Delivery links
  currentBaselineVersion Int?
  tags       String[] @default([])   // (yêu cầu owner b — xem §7)
  dimensions Json     @default("{}")  // (yêu cầu owner b)
  createdAt DateTime @default(now())  updatedAt DateTime @updatedAt
  @@unique([tenantId, code])
  @@index([tenantId, status]) @@index([tenantId, projectKind]) @@index([tenantId, canonicalProjectId])
}
```
- **LINK Solution Delivery:** `Engagement.executionProjectId?` (thêm cột phía Engagement) ↔ `ExecutionProject`
  với `projectKind="IMPLEMENTATION"`; `tenantLaunchId`→`TenantLaunch.id`. Tái dùng engine PM, không build lại
  (xem `ENTITY_COLLISION_PLAN` §4).

## 2. `NativeWorkItem` (W1) — bám `contracts/work-item.schema.json` (title "NativeWorkItem") + `docs/02`

```
model NativeWorkItem {
  id           String   @id @default(cuid())
  tenantId     String
  projectId    String?           // → ExecutionProject.id (null = standalone work)
  parentId     String?           // self-ref cây WBS (resolve trong code)
  wbsCode      String?
  type         String   @default("TASK")    // TASK|SUBTASK|ACTION|MILESTONE|DELIVERABLE|FOLLOW_UP
  title        String
  description  String?
  status       String   @default("BACKLOG") // BACKLOG|TODO|IN_PROGRESS|REVIEW|BLOCKED|DONE|CANCELLED
  priority     String   @default("NORMAL")  // LOW|NORMAL|HIGH|URGENT
  ownerId      String?
  assigneeIds  String[] @default([])
  workgroupId  String?
  assignmentSnapshot Json?        // snapshot khi resolve trách nhiệm (audit ổn định)
  plannedStart DateTime?  dueAt DateTime?  actualStart DateTime?  completedAt DateTime?
  estimateMinutes Int?    weight Float?     progressPercent Int @default(0) // 0..100
  sourceContext Json?                       // nguồn phát sinh (directive/ticket/request…)
  // ---- yêu cầu owner (b): tag + đa chiều phân tích (xem §7) ----
  tags       String[] @default([])
  dimensions Json     @default("{}")        // { "loai_viec":"BUG", "giai_doan":"UAT", ... }
  createdAt DateTime @default(now())  updatedAt DateTime @updatedAt
  @@index([tenantId, projectId]) @@index([tenantId, parentId])
  @@index([tenantId, status]) @@index([tenantId, type])
  @@index([tenantId, dueAt])
}
```
- **checklist/comments/evidence/attachments:** comments qua bảng `NativeWorkItemComment` (như `RequestComment`);
  attachments/evidence reuse `RecordDocument(subjectType="NativeWorkItem")`; checklist = `Json` trên item hoặc bảng
  con `NativeWorkItemChecklist` (chốt ở W1). Timeline: `NativeWorkItemEvent` append-only.

## 3. `WorkDependency` (W2) — bám `contracts/work-dependency.schema.json`

```
model WorkDependency {
  id           String @id @default(cuid())
  tenantId     String
  predecessorId String   // → NativeWorkItem.id
  successorId   String   // → NativeWorkItem.id
  type         String @default("FS")   // FS|SS|FF|SF
  lagMinutes   Int    @default(0)
  createdAt DateTime @default(now())
  @@unique([tenantId, predecessorId, successorId, type])
  @@index([tenantId, predecessorId]) @@index([tenantId, successorId])
}
```

## 4. Baseline: `ProjectBaseline` + `BaselineItem` (W2) — bám `docs/02` "Immutable snapshot"

```
model ProjectBaseline {
  id String @id @default(cuid())  tenantId String  projectId String
  version Int    label String?    capturedBy String?  capturedAt DateTime @default(now())
  note String?
  @@unique([tenantId, projectId, version])
  @@index([tenantId, projectId])
}
model BaselineItem {   // snapshot bất biến lịch/tiến độ của từng work item tại thời điểm baseline
  id String @id @default(cuid())  tenantId String  baselineId String  workItemId String
  plannedStart DateTime?  plannedFinish DateTime?  weight Float?  progressPercent Int?
  @@index([tenantId, baselineId])
}
```
- Rebaseline = tạo `version` mới; hàng cũ **không** sửa (append-only). `ExecutionProject.currentBaselineVersion` trỏ bản hiện hành.

## 5. `ProjectMilestone` — quyết định: **dùng `NativeWorkItem type="MILESTONE"`**

Theo `docs/02` ("May be represented by NativeWorkItem type MILESTONE, but keep a stable query/view contract").
→ Không tạo bảng riêng; cung cấp **view/query contract** `listMilestones(projectId)` = `NativeWorkItem where type=MILESTONE`.
Nếu sau này cần field milestone-riêng thì thêm cột nullable, vẫn giữ contract.

## 6. `ProjectRoleAssignment` (W2) + `WorkLink`/`ExternalWorkLink`

```
model ProjectRoleAssignment {
  id String @id @default(cuid())  tenantId String  projectId String
  subjectType String   // USER|POSITION|GROUP|ORG_UNIT  (resolve qua Identity/Org Core)
  subjectId   String
  role        String   // PROJECT_MANAGER|SPONSOR|DELIVERY_LEAD|MEMBER|OBSERVER|DATA_STEWARD
  visibilityTier String @default("FULL") // FULL|SUMMARY  (xem §8 — OBSERVER mặc định SUMMARY)
  effectiveFrom DateTime?  effectiveTo DateTime?
  createdAt DateTime @default(now())
  @@index([tenantId, projectId]) @@index([tenantId, subjectType, subjectId])
}

// WorkLink: nối NativeWorkItem/ExecutionProject tới thực thể nội bộ khác (no dual-write)
model WorkLink {
  id String @id @default(cuid())  tenantId String
  workItemId String?  projectId String?
  kind String   // DIRECTIVE|TICKET|BOOKING|REQUEST|ENGAGEMENT|MDM_PROJECT|CUSTOMER|DOCUMENT|WORKFLOW_TASK|CALENDAR
  refSystem String  refType String  refId String   // SourceReference: pointer, không copy
  meta Json @default("{}")
  createdAt DateTime @default(now())
  @@index([tenantId, workItemId]) @@index([tenantId, projectId]) @@index([tenantId, kind, refId])
}

// ExternalWorkLink: nối tới hệ ngoài (FinERP/XBooking/XBuilding/Mattermost/Calendar/email) — bám external-work-link.schema.json
model ExternalWorkLink {
  id String @id @default(cuid())  tenantId String  workItemId String
  externalSystem String  externalType String  externalId String  url String?
  syncStatus String @default("linked")  lastSyncedAt DateTime?
  createdAt DateTime @default(now())
  @@index([tenantId, workItemId]) @@index([tenantId, externalSystem, externalId])
}
```
- `WorkflowTask` (thực tế `ApprovalTask`) nối qua `WorkLink{kind:"WORKFLOW_TASK", refId:approvalTaskId}` — **không** đụng `ApprovalTask`.

---

## 7. YÊU CẦU OWNER (b) — Tag + phân tích ĐA CHIỀU (first-class)

> Owner: *"tag hoặc nhiều chiều phân tích để thống kê"*.

**Mô hình:**
- `NativeWorkItem.tags String[]` + `ExecutionProject.tags String[]` — nhãn tự do, đa giá trị.
- `NativeWorkItem.dimensions Json` (key→value) — chiều phân tích có cấu trúc, ví dụ
  `{ "loai_viec":"BUG", "giai_doan":"UAT", "nhom_chi_phi":"CAPEX", "bo_phan":"QA" }`.
- **Catalog chiều do tenant định nghĩa** — bảng mới:

```
model WorkDimension {   // danh mục chiều phân tích, tenant tự định nghĩa
  id String @id @default(cuid())  tenantId String
  key   String   // "loai_viec" | "giai_doan" | "nhom_chi_phi" | "bo_phan"
  label String   // "Loại việc" | "Giai đoạn" | "Nhóm chi phí" | "Bộ phận"
  allowedValues Json @default("[]")  // [{value,label,color?}] hoặc rỗng = tự do
  active Boolean @default(true)  sortOrder Int @default(0)
  createdAt DateTime @default(now())
  @@unique([tenantId, key])
  @@index([tenantId, active])
}
```

**Indexing cho aggregate (pivot/cross-tab theo bất kỳ tag/chiều):**
- `tags`: GIN index (`@@index([tags], type: Gin)` qua raw migration) để lọc `tags @> [...]`.
- `dimensions` (jsonb): GIN index (`jsonb_path_ops`) để filter `dimensions @> '{"giai_doan":"UAT"}'`.
- Thống kê chạy `GROUP BY dimensions->>'key'` / unnest(tags) trong query read-model, luôn kèm `tenantId` (RLS).
- Read-model thống kê rebuildable; không lưu số liệu tổng hợp làm SoR.

## 8. YÊU CẦU OWNER (a) — Tầng hiển thị PHỐI HỢP: SUMMARY vs FULL (first-class)

> Owner: *"xem việc cha + tiến độ trong Gantt phối hợp, không xem việc con/mô tả/tài liệu"*.

### 8.1 Quyền
- Tách **`work.view.summary`** (chỉ tóm tắt) vs **`work.view.full`** (đầy đủ) — bổ sung vào bộ permission
  `docs/07` (`work.view`, `work.create`, …). Đăng ký trong role registry + `PermissionPolicy`.
- `ProjectRoleAssignment.visibilityTier`: **OBSERVER mặc định = SUMMARY**; MEMBER/PM/… = FULL.

### 8.2 Chia sẻ phối hợp (coordination share) — bảng mới
```
model CoordinationShare {   // cấp quyền xem TÓM TẮT cross-team ở mức item/dependency/project
  id String @id @default(cuid())  tenantId String
  scope String   // PROJECT | WORK_ITEM | DEPENDENCY
  scopeId String  // projectId | workItemId | dependencyId
  audienceType String  // USER|POSITION|GROUP|ORG_UNIT|PROJECT_ROLE
  audienceId String?
  tier String @default("SUMMARY")  // SUMMARY (mặc định) | FULL
  createdBy String  createdAt DateTime @default(now())
  @@index([tenantId, scope, scopeId]) @@index([tenantId, audienceType, audienceId])
}
```

### 8.3 Read-model / DTO split (bắt buộc)
- **`SummaryWorkItemDTO`** = CHỈ: `id, title, status, progressPercent, plannedStart, plannedFinish/dueAt,
  type(có phải MILESTONE), rolledUp:true`. **ẨN**: `description, checklist, comments, attachments/evidence,
  assigneeIds`, và **KHÔNG trả children** (việc con ẩn).
- **`FullWorkItemDTO`** = toàn bộ field + children + description/checklist/comments/attachments.
- Server chọn DTO theo quyền hiệu lực: `full = work.view.full ∧ (member/observer=FULL ∨ CoordinationShare.tier=FULL)`;
  ngược lại trả Summary. **Không** để client tự lọc.

### 8.4 Gantt phối hợp
- Query Gantt phối hợp (cross-team) chỉ join tới các item mà viewer có tier tương ứng:
  - Với item ở tier SUMMARY: render **thanh cha đã roll-up** (progress tổng hợp từ con qua `progressMethod`),
    **children bị bỏ khỏi payload** ở tầng service (không chỉ ẩn ở UI).
  - Milestone (`type=MILESTONE`) vẫn hiển thị mốc.
- Roll-up tiến độ tính ở server; viewer SUMMARY không bao giờ nhận dữ liệu con/mô tả/tài liệu.

---

## 9. RLS / migration / rollback (áp cho MỌI bảng mới ở trên)

- **RLS + isolation test** cho từng bảng tenant mới: thêm vào `scripts/rls-setup.mjs` (`TENANT_TABLES`) +
  `scripts/rls-test.mjs`; có case isolation 2 chiều (tenant A không đọc được tenant B) như `test:t002`.
  Bảng mới: `ExecutionProject, NativeWorkItem, NativeWorkItemComment, NativeWorkItemEvent, WorkDependency,
  ProjectBaseline, BaselineItem, ProjectRoleAssignment, WorkLink, ExternalWorkLink, WorkDimension, CoordinationShare`
  → **55 → 67 bảng RLS** (12 bảng, con số cuối chốt khi implement).
- **Non-destructive:** chỉ ADD; cột link trên `Engagement` (`executionProjectId`) là nullable additive.
- **Backup/rollback:** mỗi migration kèm ghi chú backup (per-tenant `BackupJob`) + rollback (drop bảng mới an toàn vì
  không có bảng cũ phụ thuộc). Bao gồm bảng mới vào manifest backup/restore per-tenant.
- **Projection rebuildable:** `UnifiedWorkItem` phải dựng lại được từ `NativeWorkItem` + `ApprovalTask` sau restore.
