# PEOPLE ESSENTIALS — TEST PLAN (PE-01 Leave & Availability)

> Kế hoạch seed + smoke cho slice Leave, **bám đúng khuôn `scripts/manage-slice-smoke.mjs` và
> `scripts/ioc-twin-smoke.mjs`** đang chạy. Không phát minh convention mới.
> Đọc kèm: `PE_SCHEMA_PLAN.md`, `PE_API_ROUTE_PLAN.md`, `PE_SOR_MATRIX_DELTA.md`.

---

## 1. Convention đã verify trong repo (bắt buộc theo)

| Yếu tố | Giá trị thật | Nguồn |
|---|---|---|
| Runtime test | Node ESM `.mjs` thuần, `import 'dotenv/config'`, `fetch` tới API đang chạy | mọi `scripts/*-smoke.mjs` |
| Base URL | `const BASE = process.env.XOFFICE_BASE \|\| 'http://localhost:4000'` | `manage-slice-smoke.mjs:17` |
| Tenant chính | `'tenant-xtech'` (T001) | như trên |
| Tenant đối chứng | `'tenant-demo-isolation'` | như trên |
| Header | `{ 'content-type':'application/json', 'x-tenant-id': t, 'x-user-id': 'user-nam' }` | như trên |
| Đánh dấu dữ liệu test | `const MARK = \`PE-SMOKE-${Date.now()}\`` prefix mọi code tạo ra | như trên |
| Assert | `ok(cond, msg)` in `✓`/`✗`, tăng `failed`, `process.exit(failed ? 1 : 0)` | như trên |
| Tự dọn | có `reset` script riêng (`manage-slice-reset.mjs`) HOẶC self-clean cuối smoke | `test:manage-slice` = reset && smoke |
| Truy vấn DB trực tiếp | `import pg from 'pg'` khi cần chứng minh ở tầng DB (RLS) | `rls-test.mjs`, `manage-slice-smoke.mjs` |
| Khai báo npm | `"seed:x": "node scripts/x-seed.mjs"`, `"test:x": "node scripts/x-smoke.mjs"` | `package.json` |
| Từ khoá âm tính | **`MUST_NOT_LEAK`** — đã dùng ở `backup-smoke`, `catalog-smoke`, `demos-smoke`, `auth-flow-smoke`, `blueprint-catalog-seed` | grep |

⚠️ **Server phải đang chạy** — mọi smoke gọi HTTP thật, không mock.

---

## 2. Seed — `scripts/people-leave-seed.mjs`

Bám `seed/people-essentials-t001.seed.json` của handoff, **nhưng dùng OrgUnit id THẬT của T001**
(`ou-exec, ou-sales, ou-fin, ou-hr, ou-tech, ou-admin, ou-solution, ou-impl, ou-delivery, ou-support, ou-platform`)
— **không** dùng `org-*` như seed handoff giả định (bẫy này đã làm IOC phải remap, xem `IOC_CURRENT_STATE_DELTA` §1).

| Bước | Nội dung |
|---|---|
| 1 | `PeopleTenantConfig` cho `tenant-xtech`: `attendanceMode=FILE_IMPORT`, `leaveMode=XOFFICE`, `payrollMode=FILE_IMPORT`, `timesheetEnabled=true`, `performanceBridgeEnabled=true`, `iocCapacityEnabled=true`, `workingWeekdays=[1..5]`, `defaultStandardHoursPerDay=8` (khớp seed JSON handoff) |
| 2 | 5 `LeavePolicyRef`: `ANNUAL` (12 ngày/năm, paid), `SICK` (paid, `requiresAttachment=true`), `UNPAID` (`accrualMethod=NONE`), `COMP` (paid), `REMOTE` (paid) |
| 3 | `LeaveBalanceSnapshot` `reason=INITIAL`, `sequence=1`, kỳ `2026` cho **mỗi PersonProfile đang `status=active`** của T001 (lấy động, **không hardcode 30 người**) |
| 4 | Kịch bản (khớp `scenarios[]` handoff): `HAPPY_PATH_LEAVE_APPROVED` (1 đơn đã APPROVED), `LEAVE_CHANGES_REQUESTED` (1 đơn CHANGES_REQUESTED) |
| 5 | **Negative seed** ở `tenant-demo-isolation`: 1 `LeaveRequest` + 1 `LeaveBalanceSnapshot` + 1 `LeaveImpactSnapshot` với `reason`/`title` chứa chuỗi **`MUST_NOT_LEAK_LEAVE`** |
| 6 | Idempotent: chạy lại **không** nhân đôi (upsert theo `(tenantId, code)` / `(tenantId, idempotencyKey)`) — như `seed-manage.mjs` |

Chạy dưới `withBypass` (seed context), giống các seeder hiện có.

Reset: `scripts/people-leave-reset.mjs` xoá mọi dòng có `MARK`/prefix seed ở cả hai tenant.

npm scripts thêm vào `xhub-api/package.json`:
```json
"seed:people-leave": "node scripts/people-leave-seed.mjs",
"test:people-leave": "node scripts/people-leave-reset.mjs && node scripts/people-leave-smoke.mjs"
```

---

## 3. Smoke — `scripts/people-leave-smoke.mjs`

Chứng minh **toàn bộ reference slice của `START-HERE.md`** chạy end-to-end, mỗi mũi tên là liên kết thật:

```text
Nhân viên xin nghỉ → kiểm tra số dư/lịch/trùng → xem ảnh hưởng (task/meeting/approval)
→ chọn người thay thế → quản lý duyệt → cập nhật Availability → giảm Capacity phòng ban
→ phát event → (IOC đọc)
```

### Nhóm A — Config & Policy
| # | Assert |
|---|---|
| A1 | `GET /api/people/config` → 200, `leaveMode === 'XOFFICE'` |
| A2 | `GET /api/people/leave-policies` → chứa đủ 5 mã `ANNUAL/SICK/UNPAID/COMP/REMOTE` |
| A3 | `PATCH /api/people/config { leaveMode: 'INVALID' }` → **400 `INVALID_MODE`** |

### Nhóm B — Số dư & tạo đơn (happy path)
| # | Assert |
|---|---|
| B1 | `GET /api/people/me/leave-balance` → có `ANNUAL`, `available > 0`. **Ghi lại `before`** |
| B2 | `POST /leave-requests/impact-preview` → 200, **không có dòng `LeaveRequest` mới trong DB** (query pg đếm trước/sau) |
| B3 | Impact preview trả `summary` có khoá `workItems`, `approvals`, `bookings`, `capacityDeltaHours` |
| B4 | `POST /leave-requests` (kèm `idempotencyKey`) → 201, `status === 'SUBMITTED'`, `durationValue` **do server tính** (gửi `durationValue: 999` từ client → server **bỏ qua**) |
| B5 | Số dư sau submit: `pending` tăng đúng `durationValue`, `available` giảm tương ứng |
| B6 | `LeaveBalanceSnapshot` có dòng mới `reason='LEAVE_SUBMITTED'`, `sequence = trước + 1`, **dòng cũ KHÔNG bị sửa** (so `updatedAt`/nội dung — bảng không có `updatedAt`, so id + giá trị) |
| B7 | `LeaveImpactSnapshot` có dòng `capturedPhase='ON_SUBMIT'` |

### Nhóm C — Idempotency (bắt buộc)
| # | Assert |
|---|---|
| C1 | POST lại **cùng `idempotencyKey`** → **200** (không phải 201/409), trả **đúng `id` cũ**, `replayed === true` |
| C2 | Tổng số `LeaveRequest` **không tăng** sau C1 (đếm bằng pg) |
| C3 | Số dư **không bị trừ hai lần** sau C1 |
| C4 | POST thiếu `idempotencyKey` → **400 `MISSING_IDEMPOTENCY_KEY`** |
| C5 | POST `idempotencyKey` < 8 ký tự → 400 (theo `contracts/leave-request.schema.json` `minLength: 8`) |

### Nhóm D — Ràng buộc miền
| # | Assert |
|---|---|
| D1 | Đơn thứ hai **chồng khoảng** cùng người → **409 `LEAVE_OVERLAP`** |
| D2 | Xin nghỉ vượt số dư loại `ANNUAL` (`allowNegative=false`) → **409 `INSUFFICIENT_BALANCE`** |
| D3 | Xin `UNPAID` (`accrualMethod=NONE`) vượt "số dư" → **cho phép** (không chặn) |
| D4 | Nhảy sai FSM (`approve` một đơn `DRAFT`) → **409 `INVALID_TRANSITION`** |
| D5 | `PATCH` một đơn `APPROVED` → **409 `INVALID_TRANSITION`** |
| D6 | Đặt `leaveMode='FRAPPE_HR'` rồi POST đơn → **409 `SOR_NOT_XOFFICE`** (chống dual-write). Khôi phục lại `XOFFICE` sau test |

### Nhóm E — Duyệt & availability
| # | Assert |
|---|---|
| E1 | `POST /:id/approve` → 200, `status='APPROVED'`, có `decidedAt`/`decidedBy` |
| E2 | Số dư: `pending` giảm, `used` tăng đúng lượng; dòng snapshot mới `reason='LEAVE_APPROVED'` |
| E3 | `LeaveImpactSnapshot` có thêm dòng `capturedPhase='ON_APPROVE'` |
| E4 | `GET /team/availability?orgUnitId=ou-tech&from=&to=` → người vừa nghỉ **hiện là không khả dụng** đúng ngày |
| E5 | `capacityDeltaHours` của org unit **giảm đúng** `durationValue × defaultStandardHoursPerDay` |
| E6 | `ApprovalTask` tương ứng đã `status` đóng (chứng minh không còn treo ở `/approvals`) |
| E7 | `OutboxEvent` tồn tại với `eventType='xoffice.people.leave.request.approved'` **và** `'xoffice.people.availability.changed'`; payload có đủ `tenantId, eventId, schemaVersion, sourceVersion, correlationId, causationId, occurredAt, classification` |

### Nhóm F — Huỷ & hoàn số dư
| # | Assert |
|---|---|
| F1 | `POST /:id/cancel` trên đơn `APPROVED` → `CANCEL_REQUESTED` (không nhảy thẳng `CANCELLED`) |
| F2 | `POST /:id/cancel-approve` → `CANCELLED`; số dư **hoàn về đúng bằng `before`** ở B1 |
| F3 | Snapshot mới `reason='LEAVE_CANCELLED'`; **không dòng nào bị xoá** (append-only — đếm dòng chỉ tăng) |
| F4 | Availability trả người đó về **khả dụng** trong khoảng đó |

### Nhóm G — Phạm vi (ABAC)
| # | Assert |
|---|---|
| G1 | Manager của `ou-tech` `approve` một đơn của `ou-sales` → **403 `OUT_OF_SCOPE`** |
| G2 | `GET /team/leave-requests` của manager `ou-tech` **không** chứa đơn của `ou-sales` |
| G3 | Nhân viên A `GET /leave-requests/:id` của nhân viên B → **403** |

### Nhóm H — RLS `MUST_NOT_LEAK_LEAVE` (bắt buộc)
Theo đúng khuôn `manage-slice-smoke.mjs` (*"a different tenant MUST_NOT_LEAK any of the slice's rows"*):

| # | Assert |
|---|---|
| H1 | Gọi **cùng** endpoint với `x-tenant-id: tenant-demo-isolation` → **không** thấy bất kỳ đơn nào của `tenant-xtech` |
| H2 | Ngược lại: `tenant-xtech` **không** thấy dòng chứa `MUST_NOT_LEAK_LEAVE` |
| H3 | **Tầng DB (pg thuần, không qua app):** `set_config('app.current_tenant','tenant-demo-isolation')` → `SELECT * FROM "LeaveRequest"` **không** trả dòng nào của xtech |
| H4 | **Fail-safe:** **không** set `app.current_tenant` → `SELECT count(*)` trên cả 6 bảng PE = **0** |
| H5 | Với mỗi tenant đơn lẻ, **mọi** dòng thấy được đều đúng `tenantId` đó (khuôn assert #4 của `rls-test.mjs`) |
| H6 | Chuỗi `MUST_NOT_LEAK_LEAVE` **không** xuất hiện trong bất kỳ response nào của `tenant-xtech` (kiểm bằng `JSON.stringify(all).includes(...)`) |

### Nhóm I — Audit
| # | Assert |
|---|---|
| I1 | Mỗi lần chuyển trạng thái sinh **đúng một** `AuditLog` |
| I2 | `AuditLog` không chứa nội dung nhạy cảm ngoài id + trạng thái |

---

## 4. Mở rộng `rls-test.mjs`

Thêm 6 tên bảng vào cuối `TENANT_TABLES` của `scripts/rls-test.mjs` (**song song** với `rls-setup.mjs`):
`PeopleTenantConfig`, `LeavePolicyRef`, `LeaveBalanceSnapshot`, `LeaveRequest`, `LeaveImpactSnapshot`,
`OvertimeRequest`. `npm run test:rls` phải PASS cả 4 mệnh đề gốc (thấy đúng tenant / không thấy tenant khác /
chưa set = 0 dòng / MUST_NOT_LEAK) trên cả 6 bảng.

---

## 5. ⚠️ Không hardcode số bảng RLS

Số hiện tại là **89**, sẽ thành **95** sau PE-01 — nhưng agent IOC template-gallery đang chạy song song có
thể làm nó dịch. Test nào cần con số phải **đọc động**:

```js
const { TENANT_TABLES } = await import('./rls-setup.mjs');   // hoặc parse mảng
ok(TENANT_TABLES.includes('LeaveRequest'), 'LeaveRequest đã đăng ký RLS');
```
Assert **sự có mặt của tên bảng**, không assert `length === 95`.

---

## 6. Gate PASS của PE-01

```bash
cd D:\Code\xhub-saas\xhub-api
npm run rls:setup          # idempotent
npm run test:rls           # 4 mệnh đề × 95 bảng — PASS
npm run seed:people-leave  # idempotent, chạy 2 lần cho ra cùng kết quả
npm run test:people-leave  # reset && smoke — 0 failure
npm run test:manage-slice  # REGRESSION — không được vỡ (Constitution #13)
npm run test:ioc-twin      # REGRESSION
npm run test:smoke         # REGRESSION XOffice e2e
npm run scan:secrets       # không secret nào lọt ra ngoài .env*
```

**Không được che lỗi bằng demo fallback** (`/people-essentials-verify-slice`). Nếu số dư sai, smoke phải đỏ —
không được rơi về dữ liệu mẫu.

---

## 7. Kiểm thử thủ công (đưa vào `/docs/test`)

Theo quy ước dự án (bảng bot-test + tick người dùng ở `/docs/test` → đồng bộ `TEST_LOG.md`):

| ID | Kịch bản | Kỳ vọng |
|---|---|---|
| PE-U01 | Nhân viên xin nghỉ 3 ngày có việc đang mở | Impact preview liệt kê đúng task + gợi ý người thay thế |
| PE-U02 | Nhân viên xin nghỉ vượt số dư | Chặn, thông báo tiếng Việt rõ ràng, nêu số dư còn lại |
| PE-U03 | Nhân viên xin nghỉ trùng đơn cũ | Chặn, chỉ ra đơn đang trùng |
| PE-U04 | Quản lý duyệt từ **`/approvals`** (không phải từ màn People) | Duyệt được; trạng thái đơn đồng bộ ở cả hai màn |
| PE-U05 | Người nghỉ đang giữ nhiệm vụ duyệt | Hệ thống gợi ý tạo `Delegation`; **không** tự động tạo |
| PE-U06 | Huỷ đơn đã duyệt | Qua bước `CANCEL_REQUESTED`, số dư hoàn đúng |
| PE-U07 | Quản lý xem lịch hiện diện nhóm | Đúng người, đúng ngày, capacity giảm đúng |
| PE-U08 | Manager phòng khác mở đơn ngoài phạm vi | Báo không có quyền, không lộ nội dung |
| PE-U09 | Mất mạng giữa lúc gửi đơn, gửi lại | Chỉ một đơn được tạo (idempotency) |
