# XOffice Operational Delta Plan (PH-02)

> Phạm vi: hoàn thiện vận hành 6 nghiệp vụ X.Office cho pilot X-TECH nội bộ.
> Nguyên tắc: **tái sử dụng engine XOffice hiện có, KHÔNG mở rộng engine ngoài 6 luồng này.**
> Nguồn chuẩn: handoff `docs/06_XOFFICE_OPERATIONAL_SCOPE.md`, `data/FLOW_CATALOG.csv`
> (FLOW-04..FLOW-09), `data/SCREEN_CATALOG.csv` (XO-01..XO-14), `backlog/IMPLEMENTATION_BACKLOG.csv`
> (NX-020..NX-029).
> Tài liệu anh em (tham chiếu, không lặp lại nội dung): `CURRENT_RELEASE_DELTA_ANALYSIS.md`,
> `PHASE_EXECUTION_PLAN.md`, `SEED_MIGRATION_PLAN.md`, `DOCUMENT_MIGRATION_PLAN.md`,
> `X2BMS_BATCH0_DRYRUN_PLAN.md`, `BACKUP_UAT_RUNBOOK.md`.

## 0. Nền tảng đã có (verified trong code)

Engine `xhub-api/src/xoffice/*` đã cung cấp (đã xác minh qua
`xoffice.service.ts` + `xoffice.controller.ts`):

| Năng lực | Bằng chứng code |
|---|---|
| Assignment resolver (candidate/delegation/fallback) | `AssignmentResolver` (`../identity/assignment-resolver.service`), `TA-10 /admin/assignment-resolver` |
| Delegation (ủy quyền, chống loop/overlap) | `xoffice.types.Delegation`, `GET/POST api/xoffice/delegations` |
| SLA + escalation | `DEFAULT_SLA_HOURS = 24`, cột `slaHours`/`escalated`, `scheduler.service.ts`, `POST api/xoffice/scheduler/tick` |
| Condition AST (and/or/not, so sánh, hàm) | `condition-ast.ts` + `evaluateCondition`, contract `contracts/condition-ast.schema.json`, gate G-10 |
| Parallel + subflow | `subflowSeq` (child instance code, không random), nhánh parallel trong service |
| Idempotency | "seed (idempotent upserts)", correlation/audit `GET api/xoffice/audit` |
| UnifiedWorkItem projection (SoR) | `GET api/xoffice/work-items`, `POST api/xoffice/work-items/rebuild`; FE `/inbox` đọc projection này |
| External execution MANUAL_TASK (không giả lập chứng từ ERP) | `resolveExecutionMode()` → `AUTO`/`MANUAL_TASK`/`WAITING_FOR_CONNECTOR`; owner ≠ XOFFICE → MANUAL_TASK; `GET api/xoffice/external-executions`, `POST api/xoffice/external-executions/:id/reference` |
| Runtime chung | `GET forms`, `POST workflows/:code/requests`, `GET tasks`, `POST tasks/:id/act`, `GET instances` |

13 workflow đã seed (12 pilot PILOT-01..PILOT-12 + `WF-COMPLEX-DEMO`). `/inbox` (SCREEN
`XO`/inbox) đã đọc SoR projection thật.

**Kết luận:** engine đủ để chạy toàn bộ FLOW-04..FLOW-09. Delta PH-02 nằm ở **màn hình,
state-machine cấp Request, và 4 module nghiệp vụ (Directive/Ticket/Booking/Announcement) +
seed vận hành** — KHÔNG phải ở engine.

---

## 1. Request / Approval (FLOW-04, FLOW-05 · NX-020, NX-021, NX-022, NX-023, NX-024)

### Engine đã có
Instance/task runtime, phân công, delegation, SLA, condition (rẽ nhánh CFO/CEO theo
`amountVnd >= 200_000_000`), MANUAL_TASK execution + reference entry, projection.

### Delta phải làm
1. **Màn Request Center — XO-02 `/office/requests`** (new-live, NX-020): catalog thủ tục
   (procedure) + search + favorites. Nguồn: Procedure API (map từ `GET api/xoffice/workflows`
   + `GET forms`). Không demo fallback trên staging.
2. **Màn My Requests — XO-04 `/requests`** (new-live, NX-020): danh sách yêu cầu của tôi,
   filter theo status + timeline. Nguồn: Request API (map từ `GET api/xoffice/instances`
   lọc theo requester).
3. **XO-03 `/office/requests/new/[code]`** (refine): form runtime + AI completeness +
   attachments (dùng records — xem §Records dưới).
4. **XO-05 `/requests/[id]`** (refine): comment/supplement/withdraw/evidence timeline.
5. **XO-06 `/tasks/[id]`** (replace-demo → NX-024): thay stub XH-05 bằng detail thật đọc
   projection/task. Hiện `/tasks` **chưa tồn tại** trong FE (`src/app/(app)/tasks` trống) → build mới.
6. **XO-07 `/approvals/[id]`** (refine, NX-022): Approve/Reject/Return/Delegate. `/approvals`
   list đã có (`ApprovalsClient.tsx`); thiếu màn **detail [id]** → build.
7. **Comments/mentions/attachments (NX-021)**: tenant-scoped + audit. Comment/mention là
   **lớp mới** (chưa có trong engine) — gắn vào instance qua correlation, KHÔNG đưa vào
   workflow-definition. Attachment tái dùng `/api/records` (xem `DOCUMENT_MIGRATION_PLAN.md`).

### State machine cấp Request (NX-022 — bắt buộc test, gate G-04/G-10)
Trạng thái chuẩn (handoff 06):

```
DRAFT → SUBMITTED → IN_REVIEW ─┬─→ WAITING_SUPPLEMENT → RESUBMITTED → IN_REVIEW
                               ├─→ APPROVED → EXECUTING → COMPLETED
                               ├─→ APPROVED → EXECUTING → FAILED_EXTERNAL_ACTION → EXECUTING
                               └─→ REJECTED
DRAFT/SUBMITTED/IN_REVIEW ──(người tạo)──→ WITHDRAWN
bất kỳ trước APPROVED ──(admin/rule)──→ CANCELLED
```

Ánh xạ action → transition:

| Action | Từ → Đến | Ai | Ghi chú |
|---|---|---|---|
| Submit | DRAFT → SUBMITTED | Requester | |
| Request supplement | IN_REVIEW → WAITING_SUPPLEMENT | Approver | mở lại quyền sửa cho requester |
| Resubmit | WAITING_SUPPLEMENT → RESUBMITTED → IN_REVIEW | Requester | **giữ nguyên workflow version đang chạy** (FLOW-05 guardrail) |
| Return previous step | IN_REVIEW → (bước trước) | Approver | dùng cơ chế node navigation của engine |
| Approve / Reject | IN_REVIEW → APPROVED / REJECTED | Approver | |
| Reassign / Delegate | (giữ trạng thái) | Approver/Admin | dùng delegation engine sẵn có |
| Withdraw | pre-APPROVED → WITHDRAWN | Requester | chỉ trước quyết định cuối (U17) |
| Cancel | pre-APPROVED → CANCELLED | Admin/rule | |
| Complete manual action | EXECUTING → COMPLETED | Người thực thi | cần evidence (dưới) |

Seed đã dùng các trạng thái này (`WAITING_SUPPLEMENT`, `COMPLETED`, `SUBMITTED`…) → state
machine phải khớp seed. Mọi transition ghi audit (NX-021, guardrail FLOW-05 "Audit every transition").

### Quy tắc "No fake ERP document" (NX-023 · FLOW-04 guardrail)
- Bước thực thi bên ngoài KHÔNG sinh chứng từ ERP giả. Engine đã park thành
  `ExternalExecution` MANUAL_TASK (`resolveExecutionMode`: owner ≠ XOFFICE hoặc connector
  chưa live → MANUAL_TASK).
- Delta = **UI nhập evidence**: người phụ trách hoàn tất thủ công qua
  `POST api/xoffice/external-executions/:id/reference` (số PO/hoá đơn thật, file đính kèm records,
  ghi chú). Chỉ khi có reference hợp lệ mới cho phép EXECUTING → COMPLETED. U19 kiểm thử luồng này.

---

## 2. Directive / Decision / Commitment (FLOW-06 · NX-025)

### Trạng thái code
**Chưa có module** trong `xhub-api/src` (không thấy `directive`/`decision`/`commitment`).
Model đích (handoff 06): `Directive`, `Decision`, `Commitment`, `ActionItem`, `ProgressUpdate`,
`CompletionEvidence`. → **Xây mới module Directive API** (lifecycle/SLA/evidence). SLA/escalation
tái dùng cơ chế scheduler của XOffice; assignment tái dùng resolver (guardrail FLOW-06
"No workflow hardcode user").

### Màn
- XO-08 `/directives` (new-live): list + KPI + risk. FE `src/app/(app)/directives` **chưa tồn tại** → build.
- XO-09 `/directives/[id]` (new-live): action items / progress / evidence. Escalation khi quá hạn (U21).

### Seed
`seed/directives.seed.json` = **10 directive** (`DIR-2026-001..010`), có `status`
ISSUED/IN_PROGRESS/AT_RISK/OVERDUE, `assignedOrgUnit`, `dueAt`, `sourceKind=REALISTIC_SYNTHETIC`.
Đủ để hiển thị KPI/risk và test escalation U20/U21.

---

## 3. Internal Service Desk / Ticket (FLOW-07 · NX-026)

### Trạng thái code
**Chưa có module Ticket**. Model đích: service catalog, queue, public/private note, SLA
(pause/resume — guardrail FLOW-07), escalation, resolution, reopen, CSAT. → build mới.

### Màn
- XO-10 `/service-desk` (new-live): catalog / queue / SLA. FE **chưa tồn tại** → build.
- XO-11 `/service-desk/[id]` (new-live): public/private notes / resolution.

### Seed
`seed/tickets.seed.json` = **15 ticket** (`IT-2026-0001..0015`), có `serviceCode`
(ACCESS/DEVICE/NETWORK…), `assigneeId`, `priority`, `status` OPEN/ASSIGNED/IN_PROGRESS…,
`slaDueAt`. Test U22 (tạo ticket), U23 (agent private note + resolve + CSAT).

---

## 4. Booking (FLOW-08 · NX-027)

### Trạng thái code
**Chưa có module Booking**. Model đích: availability, hold, conflict, exception approval,
check-in, no-show (guardrail: calendar manual mode). → build mới.

### Màn
- XO-12 `/bookings` (new-live): availability / conflict / check-in. FE **chưa tồn tại** → build.

### Seed
`seed/bookings.seed.json` = **12 booking** (`BOOK-2026-0001..0012`), có `resourceName`,
`organizerId`, `startAt`/`endAt`, `status` CONFIRMED/PENDING_APPROVAL/CANCELLED. Đủ dựng
kịch bản xung đột lịch (U24).

---

## 5. Announcement (FLOW-09 · NX-028)

### Trạng thái code
**Chưa có module Announcement**. Model đích: audience, schedule, publish, read
acknowledgement (immutable — guardrail FLOW-09), reminder, unread report. → build mới.

### Màn
- XO-13 `/office/announcements` (new-live): publish / read receipt. FE **chưa tồn tại** → build.
- XO-14 `/office/announcements/[id]` (new-live): read acknowledgement.

### Seed
`seed/announcements.seed.json` = **6 thông báo** (`ANN-2026-001..006`), có `audience`
(ALL/ADMIN…), `requiresAcknowledgement`, `status`, `publishedAt`. Test U25 (thông báo bắt buộc
xác nhận đã đọc).

---

## 6. Records attachment (nền tảng dùng chung)

Comment/attachment/evidence của cả 6 nghiệp vụ đính kèm qua **một hợp đồng tài liệu duy nhất**
(`/api/records` — `RecordDocument`). Chi tiết ở `DOCUMENT_MIGRATION_PLAN.md`. Không tạo store
đính kèm riêng cho XOffice.

---

## 7. Bảng tổng hợp màn & backlog

| Screen | Route | Trạng thái CSV | Việc | Backlog |
|---|---|---|---|---|
| XO-01 | /office | refine-live | KPI role-home | (khung có) |
| XO-02 | /office/requests | new-live | **build Request Center** | NX-020 |
| XO-03 | /office/requests/new/[code] | refine-live | form + AI + attach | NX-020/021 |
| XO-04 | /requests | new-live | **build My Requests** | NX-020 |
| XO-05 | /requests/[id] | refine-live | comment/supplement/evidence | NX-021/022/023 |
| XO-06 | /tasks/[id] | replace-demo | **build task detail (XH-05 live)** | NX-024 |
| XO-07 | /approvals/[id] | refine-live | **build approval detail** | NX-022 |
| XO-08 | /directives | new-live | **build** + module | NX-025 |
| XO-09 | /directives/[id] | new-live | **build** | NX-025 |
| XO-10 | /service-desk | new-live | **build** + module | NX-026 |
| XO-11 | /service-desk/[id] | new-live | **build** | NX-026 |
| XO-12 | /bookings | new-live | **build** + module | NX-027 |
| XO-13 | /office/announcements | new-live | **build** + module | NX-028 |
| XO-14 | /office/announcements/[id] | new-live | **build** | NX-028 |

Đã có sẵn (tái dùng, không build lại): `/office/*` (workflow builder/instances/monitor),
`/inbox` (SoR projection), `/approvals` (list).

## 8. Seed vận hành (NX-029)
Tổng đúng manifest (`seed/SEED_MANIFEST.json`): **42 requests, 10 directives, 15 tickets,
12 bookings, 6 announcements** (+ 10 documents, 24 accounts). Tất cả `tenant-xtech`,
`sourceKind=REALISTIC_SYNTHETIC`. Isolation marker `MUST_NOT_LEAK` (tenant `demo-isolation`)
phải đi kèm để test cô lập (U38, gate G-03). Không hardcode seed trong component (03_SCREEN_CLOSURE_RULES).

## 9. Điều kiện đóng màn (áp cho mọi màn XO-*)
Theo `03_SCREEN_CLOSURE_RULES.md`: đủ loading/empty/error/permission-denied/stale;
data qua BFF + typed contract; write action có confirm/impact preview; audit/correlation
cho action nhạy cảm; breadcrumb + deep link; responsive; keyboard/focus critical journey;
seed scenario hiển thị ngay; baseline screenshot (gate G-13/G-14). Không tạo màn mới nếu
drawer/modal/tab đủ giải quyết.
