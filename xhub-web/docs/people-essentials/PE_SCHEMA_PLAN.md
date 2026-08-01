# PEOPLE ESSENTIALS — SCHEMA PLAN (lát dọc PE-01 Leave & Availability)

> Phác thảo **model Prisma cụ thể** cho slice đầu tiên `leave-availability` (mặc định của
> `/people-essentials-deliver-slice`), + `PeopleTenantConfig` là prerequisite chéo của mọi slice.
> **Docs-only — chưa migrate, chưa `db push`.** Mọi quy ước dưới đây **sao chép từ model đang chạy thật**
> trong `xhub-api/prisma/schema.prisma`, không tự chế.
> Đọc kèm: `PE_DOMAIN_COLLISION_MAP.md` (vì sao 6 bảng này là NEW), `PE_SOR_MATRIX_DELTA.md` (ai ghi).

---

## 1. Quy ước bắt buộc — trích từ code thật

Đọc `NativeWorkItem` (1627), `StrategicObjective` (1923), `Scorecard` (2089), `DataLayerDefinition` (2376):

| Quy ước | Giá trị trong repo | PE tuân thủ |
|---|---|---|
| Khoá chính | `String @id @default(cuid())` (chỉ `PersonProfile` dùng `uuid()`) | `cuid()` |
| Tenant | `tenantId String` — **không FK** tới `Tenant` (trừ vài bảng workflow đời đầu) | không FK |
| Index | luôn có `@@index([tenantId])` hoặc `@@index([tenantId, <cột lọc>])` | có |
| Enum | **KHÔNG dùng `enum` Prisma** — dùng `String` + comment liệt kê giá trị (`status String @default("BACKLOG") // BACKLOG\|TODO\|…`). Toàn schema chỉ có `TaskStatus` là enum thật (di sản). | dùng `String` + comment |
| Tham chiếu chéo domain | `String` id thuần, **không relation field**, phân giải trong code (`parentId // self-ref (resolved in code)`) | id thuần |
| Danh sách id | `String[] @default([])` (vd `assigneeIds`, `linkedMetricIds`) | dùng |
| Dữ liệu mềm | `Json @default("{}")` / `Json?` | dùng |
| Thời gian | `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt` | dùng (bảng bất biến **không** có `updatedAt`) |
| Người tạo | `createdBy String` (là `userId`, không phải `personId`) | dùng |
| Vị trí trong file | **APPEND cuối `schema.prisma`**, sau `IocTemplate` | bắt buộc |
| RLS | thêm tên bảng vào cuối `TENANT_TABLES` của **`scripts/rls-setup.mjs` VÀ `scripts/rls-test.mjs`** | bắt buộc |

⚠️ **Xung đột đồng thời:** một agent khác đang sửa `schema.prisma` (IOC template gallery). PE phải append
**sau khi** agent đó xong, và chạy `npx prisma generate` + `db push` **một lần** cho cả hai.

---

## 2. `PeopleTenantConfig` — prerequisite chéo (bắt buộc trước mọi slice)

Enum lấy **nguyên văn** từ `contracts/people-tenant-config.schema.json`.

```prisma
/// PeopleTenantConfig — CẤU HÌNH VẬN HÀNH People Essentials của MỘT tenant
/// (singleton: @@unique([tenantId])). Quyết định object nào X.Office là SoR và
/// object nào chỉ là projection từ hệ ngoài (xem PE_SOR_MATRIX_DELTA §2).
/// KHÔNG trùng với `Tenant` (registry platform, no-RLS) hay
/// `TenantApplicationInstance` (control-plane provisioning) — xem
/// PE_DOMAIN_COLLISION_MAP §3.
model PeopleTenantConfig {
  id       String @id @default(cuid())
  tenantId String

  // Operating mode — giá trị khớp people-tenant-config.schema.json
  attendanceMode String  @default("XOFFICE")      // XOFFICE | FRAPPE_HR | DEVICE | FILE_IMPORT
  leaveMode      String  @default("XOFFICE")      // XOFFICE | FRAPPE_HR
  payrollMode    String  @default("FILE_IMPORT")  // FINERP | EXTERNAL_API | FILE_IMPORT
  timesheetEnabled          Boolean @default(false)
  performanceBridgeEnabled  Boolean @default(false)
  iocCapacityEnabled        Boolean @default(false)

  /// → WorkCalendar.id (PE-02). Null ở PE-01 = dùng defaultStandardHoursPerDay.
  workCalendarId String?
  /// Mã hệ nguồn khi mode ≠ XOFFICE (vd "FRAPPE_HR_T001"). Không phải URL/secret.
  externalSystemId String?

  /// Giờ công chuẩn/ngày — dùng tính planned capacity trước khi có WorkCalendar.
  defaultStandardHoursPerDay Float @default(8)
  /// Ngày làm việc trong tuần (1=T2 … 7=CN) — thay WorkCalendar tối giản ở PE-01.
  workingWeekdays Int[] @default([1, 2, 3, 4, 5])

  createdBy String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId])
  @@index([tenantId])
}
```

> **Guard bắt buộc trong service:** mọi mutation Leave đọc config trước. Nếu `leaveMode != 'XOFFICE'`
> → trả `409 { code: 'SOR_NOT_XOFFICE' }` (chống dual-write, `PE_SOR_MATRIX_DELTA` §3).

---

## 3. `LeavePolicyRef`

```prisma
/// LeavePolicyRef — ĐỊNH NGHĨA loại nghỉ + quy tắc tích luỹ của tenant.
/// "Ref" vì ở mode FRAPPE_HR nó chỉ là tham chiếu tới policy bên ngoài
/// (externalPolicyCode + sourceVersion), ở SME Lite nó là SoR đầy đủ.
/// KHÔNG dùng RoleBinding/DataScope cho việc này — khác trục ngữ nghĩa
/// (authorization vs entitlement), xem PE_DOMAIN_COLLISION_MAP §2.
model LeavePolicyRef {
  id       String @id @default(cuid())
  tenantId String

  code String // ANNUAL | SICK | UNPAID | COMP | REMOTE  (seed T001)
  name String // "Nghỉ phép năm"
  paid Boolean @default(true)

  unit             String  @default("DAY")    // DAY | HOUR
  accrualMethod    String  @default("ANNUAL") // ANNUAL | MONTHLY | NONE
  accrualPerPeriod Float   @default(0)        // vd 12 ngày/năm; NONE → 0
  maxCarryOver     Float   @default(0)
  allowNegative    Boolean @default(false)
  requiresAttachment Boolean @default(false)  // vd SICK cần giấy khám
  minNoticeDays    Int     @default(0)
  maxConsecutiveDays Int?

  /// Áp cho ai. Rỗng = toàn tenant. Tham chiếu Identity, KHÔNG FK.
  appliesToOrgUnitIds  String[] @default([]) // → OrgUnit.id  (ou-hr, ou-tech, …)
  appliesToPositionIds String[] @default([]) // → Position.id

  status String @default("ACTIVE") // ACTIVE | RETIRED

  // ---- chỉ dùng khi leaveMode = FRAPPE_HR (projection) ----
  externalSystem     String? // FRAPPE_HR
  externalPolicyCode String?
  sourceVersion      String?
  syncedAt           DateTime?

  createdBy String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, code])
  @@index([tenantId])
  @@index([tenantId, status])
}
```

---

## 4. `LeaveBalanceSnapshot` — **bất biến**

```prisma
/// LeaveBalanceSnapshot — ẢNH CHỤP số dư nghỉ của MỘT người, MỘT loại phép, MỘT kỳ.
/// APPEND-ONLY / BẤT BIẾN: không sửa dòng cũ; mỗi lần số dư đổi (duyệt đơn, huỷ
/// đơn, tích luỹ định kỳ, điều chỉnh HR) thì GHI DÒNG MỚI với reason + sequence.
/// Số dư hiện hành = dòng có sequence lớn nhất của (person, policy, period).
/// Không có updatedAt — đúng như AssignmentResolution / LeaveImpactSnapshot.
model LeaveBalanceSnapshot {
  id       String @id @default(cuid())
  tenantId String

  personId      String // → PersonProfile.id (uuid)
  leavePolicyId String // → LeavePolicyRef.id
  periodCode    String // "2026" (ANNUAL) | "2026-08" (MONTHLY)

  openingBalance Float @default(0)
  accrued        Float @default(0)
  used           Float @default(0)
  pending        Float @default(0) // đơn SUBMITTED/IN_REVIEW đã giữ chỗ
  adjusted       Float @default(0) // HR điều chỉnh tay (+/-)
  carriedOver    Float @default(0)
  /// = opening + accrued + carriedOver + adjusted − used − pending. Lưu sẵn để query nhanh.
  available      Float @default(0)
  unit           String @default("DAY") // DAY | HOUR (copy từ policy tại thời điểm chụp)

  /// Số thứ tự tăng dần trong (tenantId, personId, leavePolicyId, periodCode).
  sequence Int @default(1)
  /// Vì sao có dòng này.
  reason String // ACCRUAL | LEAVE_SUBMITTED | LEAVE_APPROVED | LEAVE_CANCELLED | LEAVE_REJECTED | HR_ADJUSTMENT | CARRY_OVER | INITIAL
  /// → LeaveRequest.id khi reason bắt nguồn từ một đơn.
  sourceLeaveRequestId String?

  // Projection metadata — chỉ có giá trị khi leaveMode = FRAPPE_HR
  sourceSystem  String? // XOFFICE (mặc định) | FRAPPE_HR
  sourceVersion String?
  syncedAt      DateTime?

  createdBy String
  createdAt DateTime @default(now())

  @@unique([tenantId, personId, leavePolicyId, periodCode, sequence])
  @@index([tenantId])
  @@index([tenantId, personId, periodCode])
  @@index([tenantId, leavePolicyId])
}
```

> **Vì sao append-only mà không phải một dòng mutable:** số dư phép là dữ liệu **có tranh chấp** (nhân viên
> khiếu nại "tôi còn mấy ngày?"). Bảng bất biến cho phép tái dựng lịch sử mà không cần bảng audit riêng —
> cùng triết lý `AttendanceEvent` bất biến (Constitution #7) và `AssignmentResolution` đang chạy.

---

## 5. `LeaveRequest` — SoR của một lần nghỉ

Trường bắt buộc bám **nguyên văn** `contracts/leave-request.schema.json`
(`tenantId, personId, leaveTypeCode, startAt, endAt, reason, idempotencyKey` + `replacementPersonId`,
`attachmentRecordIds`). FSM theo `docs/03_STATE_MACHINES.md`.

```prisma
/// LeaveRequest — SoR của MỘT lần nghỉ (SME Lite). KHÔNG tái dùng model `Request`
/// (PH-02) vì Leave có ràng buộc khoảng thời gian / trừ số dư / impact / FSM có
/// nhánh CANCEL_REQUESTED sau APPROVED — xem PE_DOMAIN_COLLISION_MAP §5.
/// Việc DUYỆT được spawn thành ApprovalTask để hiện ở /approvals + /inbox
/// (PE_SOR_MATRIX_DELTA §4) — LeaveRequest.status vẫn là SoR trạng thái đơn.
model LeaveRequest {
  id       String @id @default(cuid())
  tenantId String

  personId  String // → PersonProfile.id — người NGHỈ
  /// Ảnh chụp org tại thời điểm nộp (Position có thể đổi sau) — dùng cho scope + capacity.
  orgUnitId  String? // → OrgUnit.id   (ou-tech, …)
  positionId String? // → Position.id

  leaveTypeCode String // = LeavePolicyRef.code (ANNUAL | SICK | …)
  leavePolicyId String // → LeavePolicyRef.id (khoá chắc, phòng khi code đổi)

  startAt DateTime
  endAt   DateTime
  /// Nửa ngày: FULL | AM | PM — áp cho ngày đầu/cuối.
  startDayPart String @default("FULL") // FULL | AM | PM
  endDayPart   String @default("FULL") // FULL | AM | PM
  /// Số ngày/giờ THỰC TRỪ, tính theo workingWeekdays + WorkCalendar. Do service tính, client không gửi.
  durationValue Float
  durationUnit  String @default("DAY") // DAY | HOUR

  reason String

  /// Người GÁNH VIỆC khi vắng — KHÁC với `Delegation` (uỷ quyền DUYỆT).
  replacementPersonId String? // → PersonProfile.id
  /// → RecordDocument.id[] (module Records) — không lưu file trong bảng này.
  attachmentRecordIds String[] @default([])

  /// FSM docs/03: DRAFT → SUBMITTED → IN_REVIEW → APPROVED|REJECTED|CHANGES_REQUESTED
  ///              → CANCEL_REQUESTED → CANCELLED
  status String @default("DRAFT")

  submittedAt DateTime?
  decidedAt   DateTime?
  decidedBy   String?   // userId người duyệt
  decisionNote String?
  cancelledAt DateTime?
  cancelReason String?

  /// → WorkflowInstance.id / ApprovalTask.id — liên kết tới hàng đợi duyệt hợp nhất.
  workflowInstanceId String?
  approvalTaskId     String?

  /// Idempotency — ĐÚNG pattern CommandLog: unique (tenantId, idempotencyKey) → replay.
  idempotencyKey String

  createdBy String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, idempotencyKey])
  @@index([tenantId])
  @@index([tenantId, personId, status])
  @@index([tenantId, status])
  @@index([tenantId, startAt, endAt])   // truy vấn availability theo khoảng
  @@index([tenantId, orgUnitId, startAt])
}
```

**Ràng buộc do service enforce (không phải DB):**
- `endAt >= startAt`; không cho phép **chồng lấn** với đơn khác cùng `personId` ở trạng thái
  `SUBMITTED|IN_REVIEW|APPROVED` → `409 { code: 'LEAVE_OVERLAP' }`.
- `durationValue` **do server tính**, bỏ qua giá trị client gửi.
- Chuyển trạng thái chỉ theo FSM; nhảy sai → `409 { code: 'INVALID_TRANSITION' }`.
- Mỗi lần đổi trạng thái: ghi `LeaveBalanceSnapshot` dòng mới + `AuditLog` + `OutboxEvent`, **cùng một transaction**.

---

## 6. `LeaveImpactSnapshot` — **bất biến**

```prisma
/// LeaveImpactSnapshot — ẢNH CHỤP BẤT BIẾN những gì bị ảnh hưởng bởi một đơn nghỉ,
/// tại thời điểm nộp (và chụp lại khi duyệt). Đây là dữ liệu XHub-ONLY: hệ HR ngoài
/// không biết task/meeting/approval nào bị đụng → X.Office là SoR ở MỌI mode.
/// Không có updatedAt (append-only, mỗi lần chụp = một dòng).
model LeaveImpactSnapshot {
  id       String @id @default(cuid())
  tenantId String

  leaveRequestId String // → LeaveRequest.id
  personId       String // → PersonProfile.id
  capturedAt     DateTime @default(now())
  capturedPhase  String // ON_SUBMIT | ON_APPROVE | ON_CANCEL

  /// → NativeWorkItem.id — việc có dueAt rơi vào khoảng nghỉ, hoặc person là owner/assignee.
  impactedWorkItemIds  String[] @default([])
  /// → NativeWorkItem.id, type = MILESTONE
  impactedMilestoneIds String[] @default([])
  /// → ApprovalTask.id đang open mà person là assignee → gợi ý tạo Delegation.
  impactedApprovalTaskIds String[] @default([])
  /// → Booking.id (họp/phòng đã đặt trong khoảng nghỉ)
  impactedBookingIds   String[] @default([])
  /// → DirectiveAssignment.id đang mở
  impactedDirectiveIds String[] @default([])
  /// → ExecutionProject.id mà person giữ ProjectRoleAssignment
  impactedProjectIds   String[] @default([])

  /// Tổng hợp để hiển thị nhanh + đưa vào event payload.
  summary Json @default("{}") // { workItems: 3, approvals: 1, bookings: 2, riskLevel: "MEDIUM" }
  /// Sức chứa bị giảm của đơn vị (giờ) — đầu vào cho PE-07 / DT-04.
  capacityDeltaHours Float @default(0)

  createdBy String
  createdAt DateTime @default(now())

  @@index([tenantId])
  @@index([tenantId, leaveRequestId])
  @@index([tenantId, personId])
}
```

> ⚠️ **Cách tính `impactedWorkItemIds` (kế thừa cảnh báo DT-00):** `NativeWorkItem` **không có `orgUnitId`**.
> Lọc theo người: `ownerId = personId OR personId = ANY(assigneeIds)`, cộng điều kiện
> `dueAt BETWEEN startAt AND endAt` và `status NOT IN ('DONE','CANCELLED')`. Không group theo org unit ở
> tầng SQL — phân giải org qua `Position.holderPersonId → Position.orgUnitId` trong code.

---

## 7. `OvertimeRequest`

```prisma
/// OvertimeRequest — YÊU CẦU làm thêm giờ. X.Office là SoR của YÊU CẦU;
/// FinERP là SoR của việc CHI TRẢ OT (Constitution #2). TimeEntry (PE-05)
/// KHÔNG mặc định là OT payroll (docs/04).
model OvertimeRequest {
  id       String @id @default(cuid())
  tenantId String

  personId   String  // → PersonProfile.id
  orgUnitId  String? // → OrgUnit.id (ảnh chụp)
  workDate   DateTime // ngày làm thêm (00:00 local)
  startAt    DateTime
  endAt      DateTime
  hours      Float    // do server tính
  otType     String   @default("NORMAL") // NORMAL | WEEKEND | HOLIDAY | NIGHT
  reason     String

  /// → NativeWorkItem.id / ExecutionProject.id — lý do công việc (tuỳ chọn).
  relatedWorkItemId String?
  relatedProjectId  String?

  /// FSM giống Leave (rút gọn): DRAFT → SUBMITTED → IN_REVIEW → APPROVED|REJECTED → CANCELLED
  status String @default("DRAFT")

  submittedAt DateTime?
  decidedAt   DateTime?
  decidedBy   String?
  decisionNote String?

  workflowInstanceId String?
  approvalTaskId     String?
  idempotencyKey     String

  createdBy String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, idempotencyKey])
  @@index([tenantId])
  @@index([tenantId, personId, workDate])
  @@index([tenantId, status])
}
```

---

## 8. Tác động RLS

**6 bảng mới** → `TENANT_TABLES` đi từ **89 → 95** (giả định agent IOC không thêm bảng có `tenantId`;
nếu có, con số dịch lên — **đọc động, đừng hardcode**).

Append vào **cuối** mảng ở **cả hai** file, kèm comment nhóm theo đúng phong cách hiện có:

```js
// X.Office People Essentials — PE-01 Leave & Availability
'PeopleTenantConfig',
'LeavePolicyRef',
'LeaveBalanceSnapshot',
'LeaveRequest',
'LeaveImpactSnapshot',
'OvertimeRequest',
```

Files: `xhub-api/scripts/rls-setup.mjs` **và** `xhub-api/scripts/rls-test.mjs`.

---

## 9. Bảng **KHÔNG** tạo ở PE-01 (dù có trong 29 thực thể)

`WorkCalendar`, `ShiftPattern`, `ShiftAssignment` → **PE-02** (PE-01 dùng
`PeopleTenantConfig.workingWeekdays` + `defaultStandardHoursPerDay` là đủ để tính duration).
`AttendanceEvent/Day/CorrectionRequest` → PE-02. `Timekeeping*` → PE-03. `Payroll*`/`Payslip*` → PE-04.
`TimeEntry`/`Timesheet` → PE-05. `PerformanceEvidenceSnapshot`/`ManagerPerformanceReview`/
`VariablePayRecommendation` → PE-06. `CapacitySnapshot`/`OrgUnitCapacityProjection` → PE-07.
`ExternalEmployeeMapping`/`PeopleSyncJob` → PE-08 (chưa có adapter nào để map tới).

---

## 10. Thứ tự migrate

1. Chờ agent IOC template-gallery hoàn tất phần sửa `schema.prisma`.
2. Append 6 model vào **cuối** file (sau `IocTemplate`).
3. `npx prisma generate` → `npx prisma db push` (repo không dùng migration file — theo runbook hiện hành).
4. Append 6 tên bảng vào `rls-setup.mjs` + `rls-test.mjs`.
5. `npm run rls:setup` → `npm run test:rls` (phải PASS toàn bộ, kể cả 6 bảng mới).
6. `npm run seed:people-leave` → `npm run test:people-leave` (xem `PE_TEST_PLAN.md`).
