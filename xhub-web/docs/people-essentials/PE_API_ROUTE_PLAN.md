# PEOPLE ESSENTIALS — API & ROUTE PLAN (lát dọc PE-01 Leave)

> Thiết kế endpoint cho slice Leave & Availability, **bám đúng convention đang chạy** của
> `src/manage/manage.controllers.ts`, `src/work/*`, `src/ioc/*` và BFF proxy
> `xhub-web/src/app/api/manage/[[...path]]/route.ts`. Verify bằng đọc mã, không suy đoán.
> Đọc kèm: `PE_SCHEMA_PLAN.md`, `PE_SOR_MATRIX_DELTA.md`, `PE_UI_MOBILE_PLAN.md`.

---

## 1. ⚠️ Sửa lỗi namespace của handoff

`contracts/openapi-people-outline.yaml` và `docs/06_API_EVENTS.md` đề xuất `/people/v1/*`.
**Repo này không dùng version segment.** Convention thật:

| Domain | Prefix controller thật |
|---|---|
| Management OS | `@Controller('api/manage/objectives')`, `api/manage/metrics`, `api/manage/reviews`, `api/manage/decisions`, `api/manage/actions`, `api/manage/scorecards`, `api/manage/okr-cycles`, `api/manage/okrs`, `api/manage/kpis` |
| Work v2 | `api/work/items`, `api/work/projects`, … |
| IOC | `api/ioc/*` |

➡️ **Quyết định: dùng `/api/people/*`, KHÔNG có `/v1/`.** Version hoá bằng field `schemaVersion` trong
payload event (như `docs/06` yêu cầu) và bằng `templateVersion` cho import — không đưa version vào URL.
Ánh xạ 1:1 với outline của handoff được ghi ở §6 để không mất dấu hợp đồng.

---

## 2. Controller backend (`xhub-api/src/people/`)

Cấu trúc module theo khuôn `src/manage/`:

```
src/people/
  people.module.ts
  people.constants.ts        // mã lỗi, danh sách reason, sourceSystem hợp lệ
  people.controllers.ts      // TẤT CẢ controller trong một file (đúng như manage.controllers.ts)
  config.service.ts          // PeopleTenantConfig
  leave-policy.service.ts    // LeavePolicyRef
  leave-balance.service.ts   // LeaveBalanceSnapshot (append-only)
  leave.service.ts           // LeaveRequest FSM + idempotency + outbox
  leave-impact.service.ts    // LeaveImpactSnapshot (đọc Work/Approval/Booking/Directive)
  availability.service.ts    // truy vấn khả dụng theo person/org/khoảng
  overtime.service.ts        // OvertimeRequest
```

Khuôn controller (sao chép **nguyên dạng** từ `manage.controllers.ts`):

```ts
@Controller('api/people/leave-requests')
@UseInterceptors(TenantScopeInterceptor)      // → withTenant → RLS
export class LeaveRequestsController {
  constructor(private readonly svc: LeaveService) {}

  @Get()
  @RequirePermission('people.self.leave.request')
  list(@Identity() id: RequestIdentity, @Query('status') status?: string) {
    return this.svc.listMine(tenant(id), user(id), { status });
  }
  // …
}
```

Helper `tenant(id)` / `user(id)` (fallback `tenant-xtech` / `user-nam`) — **giữ nguyên** như `manage`.

---

## 3. Bảng endpoint PE-01

| # | Method | Route | Quyền (`@RequirePermission`) | Mô tả | Mã lỗi đặc thù |
|---|---|---|---|---|---|
| 1 | `GET` | `/api/people/config` | `people.hr.timekeeping.manage` | Đọc `PeopleTenantConfig` của tenant | — |
| 2 | `PATCH` | `/api/people/config` | `people.hr.timekeeping.manage` | Cập nhật operating mode | `400 INVALID_MODE` |
| 3 | `GET` | `/api/people/leave-policies` | `people.self.leave.request` | Danh sách loại phép áp cho tôi | — |
| 4 | `POST` | `/api/people/leave-policies` | `people.hr.timekeeping.manage` | HR tạo/sửa policy | `409 DUPLICATE_CODE` |
| 5 | `GET` | `/api/people/me/leave-balance` | `people.self.leave.request` | Số dư hiện hành của tôi (dòng `sequence` lớn nhất mỗi policy/period) | — |
| 6 | `GET` | `/api/people/leave-requests` | `people.self.leave.request` | Đơn **của tôi** (`?status=`, `?from=`, `?to=`) | — |
| 7 | `POST` | `/api/people/leave-requests/impact-preview` | `people.self.leave.request` | **Xem trước** ảnh hưởng, **KHÔNG ghi DB** | `409 LEAVE_OVERLAP` |
| 8 | `POST` | `/api/people/leave-requests` | `people.self.leave.request` | Tạo + nộp đơn. **Bắt buộc `idempotencyKey`** | `409 LEAVE_OVERLAP`, `409 INSUFFICIENT_BALANCE`, `409 SOR_NOT_XOFFICE`, `400 MISSING_IDEMPOTENCY_KEY` |
| 9 | `GET` | `/api/people/leave-requests/:id` | `people.self.leave.request` | Chi tiết + impact snapshot | `403 FORBIDDEN`, `404` |
| 10 | `PATCH` | `/api/people/leave-requests/:id` | `people.self.leave.request` | Sửa khi `DRAFT` / `CHANGES_REQUESTED` | `409 INVALID_TRANSITION` |
| 11 | `POST` | `/api/people/leave-requests/:id/approve` | `people.team.leave.approve` | Duyệt (đóng `ApprovalTask`) | `409 INVALID_TRANSITION`, `403 OUT_OF_SCOPE` |
| 12 | `POST` | `/api/people/leave-requests/:id/reject` | `people.team.leave.approve` | Từ chối (kèm `note` bắt buộc) | như trên |
| 13 | `POST` | `/api/people/leave-requests/:id/request-changes` | `people.team.leave.approve` | Yêu cầu sửa → `CHANGES_REQUESTED` | như trên |
| 14 | `POST` | `/api/people/leave-requests/:id/cancel` | `people.self.leave.request` | Chủ đơn xin huỷ. Nếu đã `APPROVED` → `CANCEL_REQUESTED` | `409 INVALID_TRANSITION` |
| 15 | `POST` | `/api/people/leave-requests/:id/cancel-approve` | `people.team.leave.approve` | Manager duyệt huỷ → `CANCELLED`, hoàn số dư | như trên |
| 16 | `GET` | `/api/people/team/availability` | `people.team.availability.read` | `?orgUnitId=&from=&to=` — lịch hiện diện nhóm + capacity delta | `403 OUT_OF_SCOPE` |
| 17 | `GET` | `/api/people/team/leave-requests` | `people.team.leave.approve` | Hàng đợi duyệt trong phạm vi | — |
| 18 | `GET` | `/api/people/overtime-requests` · `POST` · `POST /:id/approve` · `POST /:id/reject` | `people.self.attendance.correct` (tạo) / `people.team.attendance.approve` (duyệt) | OT | `409 INVALID_TRANSITION` |

**Chưa làm ở PE-01** (nhưng đặt chỗ namespace): `/api/people/attendance/*` (PE-02),
`/api/people/timekeeping-periods/*` (PE-03), `/api/people/payslips/*` (PE-04),
`/api/people/timesheets/*` (PE-05), `/api/people/performance/*` (PE-06),
`/api/people/capacity/*` (PE-07), `/api/people/imports|exports` (PE-02/03/04).

---

## 4. Quyền — 15 mã từ `data/PERMISSION_CATALOG.csv`

CSV của handoff đã dùng **đúng convention dotted-lowercase** của repo (khác handoff IOC vốn dùng
SCREAMING_CASE và phải ánh xạ lại). **Dùng nguyên văn, không đổi tên:**

| Permission | RoleHint | Dùng ở PE-01? |
|---|---|---|
| `people.self.attendance.read` | Employee | PE-02 |
| `people.self.attendance.correct` | Employee | PE-01 (OT) + PE-02 |
| `people.self.leave.request` | Employee | ✅ PE-01 |
| `people.self.payslip.read` | Employee | PE-04 |
| `people.self.timesheet.write` | Employee | PE-05 |
| `people.team.availability.read` | Manager | ✅ PE-01 |
| `people.team.leave.approve` | Manager | ✅ PE-01 |
| `people.team.attendance.approve` | Manager/HR | ✅ PE-01 (duyệt OT) |
| `people.team.timesheet.approve` | Manager | PE-05 |
| `people.hr.timekeeping.manage` | HR | ✅ PE-01 (config + policy) |
| `people.hr.timekeeping.lock` | HR Checker | PE-03 |
| `people.hr.import.manage` | HR/Payroll | PE-02/04 |
| `people.hr.payslip.publish` | Payroll | PE-04 |
| `people.hr.performance.manage` | HR | PE-06 |
| `people.audit.read` | Auditor | ✅ PE-01 (đọc audit trail đơn nghỉ) |

**Đăng ký:** thêm vào role registry + `PermissionPolicy` seed như `scripts/platform-roles-seed.mjs` /
`role-registry-seed.mjs` đã làm. `PermissionGuard` là **no-op khi `AUTH_ENFORCE=false`** (mặc định demo) →
**quyền không tự bảo vệ được ở dev**; vì vậy scope check ở §5 phải nằm trong **service**, không chỉ ở guard.

### Hai tầng kiểm soát (bắt buộc cả hai)

1. **Tầng quyền (RBAC)** — `@RequirePermission('people.team.leave.approve')`.
2. **Tầng phạm vi (ABAC)** — **tái dùng `DataScope`** (không tự chế): trước khi trả/ghi, service phân giải
   `DataScope` của actor (`subjectType ∈ {USER, POSITION, ROLE}`) lấy `scope.orgUnits[]`, rồi:
   - `GET /team/availability`, `GET /team/leave-requests`: **lọc** theo `LeaveRequest.orgUnitId ∈ scope`.
   - `POST /:id/approve|reject`: nếu `orgUnitId ∉ scope` → **`403 OUT_OF_SCOPE`**.
   - Fallback khi actor không có `DataScope`: dùng cây quản lý `Position.reportsToPositionId` (đã có, đang
     nuôi selector `DIRECT_MANAGER`/`ORG_UNIT_HEAD`).
3. **Tầng chủ thể (self)** — `GET /leave-requests` chỉ trả đơn có `personId = personId(actor)`.
   ⚠️ Lưu ý bẫy đã gặp trong repo (`DEV_BACKLOG` known issue ticket): **`userId` ≠ `personId`**. Service phải
   phân giải qua `PersonProfile.externalIdRefs.userId` / `Membership`, không so sánh thẳng.

---

## 5. Idempotency — dùng đúng pattern đang chạy

`controlplane.service.ts:309–321` là chuẩn: unique `(tenantId, idempotencyKey)`; nếu đã tồn tại → **replay
kết quả cũ**, không tạo mới, trả **200** (không phải 409).

`POST /api/people/leave-requests` áp y hệt:
- Thiếu `idempotencyKey` (min 8 ký tự theo `contracts/leave-request.schema.json`) → `400 MISSING_IDEMPOTENCY_KEY`.
- Trùng key → trả lại đơn cũ, status **200**, header/field `replayed: true`.
- Client (web + mobile) sinh key = `uuid v4` lưu cùng form draft → retry mạng an toàn.

---

## 6. Ánh xạ hợp đồng handoff → route thật

| `openapi-people-outline.yaml` | Route thật trong repo |
|---|---|
| `GET /people/v1/me/leave` | `GET /api/people/leave-requests` |
| `POST /people/v1/me/leave` | `POST /api/people/leave-requests` |
| `GET /people/v1/me/attendance` | `GET /api/people/attendance/me` (PE-02) |
| `POST /people/v1/timekeeping-periods/{id}/lock` | `POST /api/people/timekeeping-periods/:id/lock` (PE-03) |
| `POST /people/v1/imports` | `POST /api/people/imports` (PE-02/04) |
| `GET /people/v1/me/payslips` | `GET /api/people/payslips/me` (PE-04) |

---

## 7. BFF proxy (Next.js)

Tạo **một** file `xhub-web/src/app/api/people/[[...path]]/route.ts`, copy nguyên khuôn
`src/app/api/manage/[[...path]]/route.ts`:

```ts
// FE proxy → xhub-api /api/people/* (X.Office People Essentials, PE-01 Leave slice).
// Catch-all: GET/POST/PATCH dưới /api/people được forward tới API base kèm identity
// headers chuẩn. FE KHÔNG bao giờ chạm DB. Mirrors src/app/api/manage.
import { forwardGet, forwardPost, forwardPatch, readJson } from "../../admin/_forward";

function target(path: string[] | undefined, search: string): string {
  const suffix = path && path.length ? `/${path.join("/")}` : "/leave-requests";
  return `/api/people${suffix}${search}`;
}
// GET / POST / PATCH — y hệt manage
```

Default suffix `/leave-requests` (tương đương `manage` default `/objectives`).
**Không thêm DELETE** — không endpoint PE nào xoá cứng (huỷ = chuyển trạng thái).

---

## 8. Events — qua `OutboxEvent`, không tạo bảng mới

Ghi vào `OutboxEvent` đã có (`aggregateType`, `aggregateId`, `eventType`, `payload`, `status`, `attempts`,
`maxAttempts`, `nextAttemptAt`); dispatcher retry/backoff + `/reconcile` đã chạy.

| `eventType` (từ `docs/06`) | `aggregateType` | Phát khi |
|---|---|---|
| `xoffice.people.leave.request.submitted` | `LeaveRequest` | `DRAFT → SUBMITTED` |
| `xoffice.people.leave.request.approved` | `LeaveRequest` | `→ APPROVED` |
| `xoffice.people.availability.changed` | `PersonAvailability` | sau approve/cancel-approve — **đây là event DT-04 chờ** |

`payload` bắt buộc có: `tenantId`, `eventId`, `schemaVersion`, `sourceVersion`, `correlationId`,
`causationId`, `occurredAt`, `classification` (theo `docs/06`).
`classification` cho leave = `INTERNAL`; **payslip** (PE-04) = `CONFIDENTIAL` và **không được** đưa số tiền
vào payload.

**Ba event ghi trong CÙNG transaction với mutation** (transactional outbox — pattern module `src/webhook` đã dùng).
