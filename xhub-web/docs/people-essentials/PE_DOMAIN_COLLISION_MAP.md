# PEOPLE ESSENTIALS — DOMAIN COLLISION MAP (PE-00)

> Kiểm tra **28 thực thể đề xuất** trong `docs/02_DOMAIN_MODEL.md` của handoff đối chiếu với **104 model
> Prisma đang tồn tại thật**. Mục tiêu: thực thi Constitution **#3** ("Identity/Org/Position là định danh
> dùng chung; không tạo bảng trùng nghĩa") và **#4** ("một object chỉ một System of Record; không dual-write").
> Verify bằng `grep '^model ' prisma/schema.prisma` + đọc từng model liên quan.
> Đọc kèm: `PE_SOR_MATRIX_DELTA.md` (ai sở hữu gì), `PE_SCHEMA_PLAN.md` (hình dạng bảng PE-01).

---

## 0. Nguyên tắc kiểm va chạm

Một thực thể PE **va chạm** nếu nó thoả **một trong ba**:
- **(A) Trùng nghĩa** — mô tả cùng một sự vật với bảng đã có (vi phạm #3).
- **(B) Trùng SoR** — cùng ghi trạng thái chuẩn của một object đã có chủ (vi phạm #4).
- **(C) Trùng tên** — trùng tên model/bảng trong `schema.prisma` (vỡ migration).

Quy tắc xử lý (kế thừa DT-00): **APPEND ONLY** vào cuối `schema.prisma`; **không thêm relation field vào model
cũ**; PE tham chiếu bằng **id dạng String, không FK** (đúng như `NativeWorkItem`/`StrategicObjective` đang làm).

---

## 1. Danh sách 28 thực thể — phán quyết

| # | Thực thể PE đề xuất | Có model trùng tên? | Trùng nghĩa? | Phán quyết |
|---|---|---|---|---|
| 1 | `PeopleTenantConfig` | Không | ⚠️ cần xét — §3 | **NEW** (đã giải quyết) |
| 2 | `ExternalEmployeeMapping` | Không | ⚠️ gần `AppAccountBinding` — §4 | **NEW** (đã giải quyết) |
| 3 | `WorkCalendar` | Không | Không (`Booking` là đặt phòng, khác hẳn) | **NEW** |
| 4 | `ShiftPattern` | Không | Không | **NEW** |
| 5 | `ShiftAssignment` | Không | Không (`PositionAssignment` = giữ ghế tổ chức, khác ca làm) | **NEW** |
| 6 | `AttendanceEvent` | Không | Không | **NEW** (bất biến — #7) |
| 7 | `AttendanceDay` | Không | Không | **NEW** |
| 8 | `AttendanceCorrectionRequest` | Không | ⚠️ gần `Request` — §5 | **NEW** (đã giải quyết) |
| 9 | `LeavePolicyRef` | Không | ⚠️ nghi ngờ vs `RoleBinding`/`DataScope` — §2 | **NEW** (đã giải quyết) |
| 10 | `LeaveBalanceSnapshot` | Không | ⚠️ như trên — §2 | **NEW** (đã giải quyết) |
| 11 | `LeaveRequest` | Không | ⚠️ tên chứa "Request" nhưng khác `Request` — §5 | **NEW** |
| 12 | `LeaveImpactSnapshot` | Không | Không | **NEW** (bất biến) |
| 13 | `OvertimeRequest` | Không | Không | **NEW** |
| 14 | `TimeEntry` | Không | Không | **NEW** |
| 15 | `Timesheet` | Không | Không | **NEW** |
| 16 | `TimekeepingPeriod` | Không | Không | **NEW** |
| 17 | `TimekeepingRow` | Không | Không | **NEW** |
| 18 | `TimekeepingAdjustment` | Không | Không | **NEW** |
| 19 | `TimekeepingExportBatch` | Không | ⚠️ gần `ImportJob`/`BackupJob` (khác chiều) | **NEW** |
| 20 | `PayrollImportBatch` | Không | ⚠️ gần `ImportJob` (MDM) — §6 | **NEW** (đã giải quyết) |
| 21 | `PayslipProjection` | Không | Không | **NEW** (projection, không phải SoR) |
| 22 | `PayslipReadReceipt` | Không | ⚠️ gần `AnnouncementReceipt` (khuôn giống, nghĩa khác) | **NEW** |
| 23 | `PayrollQuestion` | Không | ⚠️ gần `Ticket` — §7 | **NEW hoặc REUSE Ticket** (đã giải quyết) |
| 24 | `PerformanceEvidenceSnapshot` | Không | Không | **NEW** (bất biến) |
| 25 | `ManagerPerformanceReview` | Không | ⚠️ tên gần `BusinessReview` (MG) — nghĩa khác hẳn | **NEW** |
| 26 | `VariablePayRecommendation` | Không | Không | **NEW** (AI draft-first) |
| 27 | `CapacitySnapshot` | Không | Không (DT-00 xác nhận không tồn tại) | **NEW** |
| 28 | `OrgUnitCapacityProjection` | Không | Không | **NEW** (read model) |
| + | `PeopleSyncJob` | Không | ⚠️ gần `ProvisioningCommand`/`OutboxEvent` — §8 | **NEW nhưng thu hẹp** (đã giải quyết) |

**Kết quả trùng TÊN model: 0/29.** Không thực thể nào của PE trùng tên với 104 model hiện có.

---

## 2. ⭐ Giải quyết #1 — `LeavePolicyRef` / `LeaveBalanceSnapshot` vs `RoleBinding` / `DataScope`

**Nghi ngờ đặt ra:** cả bốn đều là "gán một thứ gì đó cho một chủ thể trong một khoảng hiệu lực" → liệu có
thể tái dùng `RoleBinding`/`DataScope` thay vì tạo bảng mới?

**Đọc mã thực tế:**

```prisma
model RoleBinding {           // schema.prisma:471
  subjectType   String   // USER | POSITION | GROUP | ORG_UNIT
  subjectId     String
  roleCode      String   // ← gán QUYỀN
  scope         Json     @default("{}")
  effectiveFrom DateTime?
  effectiveTo   DateTime?
}

model DataScope {             // schema.prisma:505
  subjectType String   // USER | POSITION | ROLE
  subjectId   String
  scope       Json     // { orgUnits?, legalEntities?, classification? } ← thu hẹp TẦM NHÌN DỮ LIỆU
}
```

**Phán quyết: KHÔNG va chạm. Tạo mới cả hai. Lý do cụ thể:**

| Tiêu chí | `RoleBinding` / `DataScope` | `LeavePolicyRef` / `LeaveBalanceSnapshot` |
|---|---|---|
| **Trục ngữ nghĩa** | *Authorization* — "được phép làm gì / nhìn thấy gì" | *Entitlement nghiệp vụ* — "được nghỉ bao nhiêu ngày" |
| **Đơn vị giá trị** | `roleCode` (chuỗi định danh quyền) / tập org unit | **Số lượng có đơn vị** (ngày/giờ) + kỳ tính (`accrualPeriod`) |
| **Ai đọc** | `PermissionGuard`, `filterNavByPermissions`, resolver phân công | Leave service, capacity engine, bảng công |
| **Hệ quả khi sai** | Lỗ hổng bảo mật | Sai số dư phép → sai lương/công |
| **Vòng đời** | Thay đổi khi tổ chức/vai trò đổi | Thay đổi **hàng tháng/quý** theo accrual, có carry-over, có expiry |
| **Tính bất biến** | Mutable | `LeaveBalanceSnapshot` là **snapshot bất biến theo kỳ** (audit số dư) |

Nhồi entitlement nghỉ phép vào `RoleBinding.scope` (Json) sẽ:
(a) làm `PermissionGuard` phải parse dữ liệu nghiệp vụ nó không quan tâm → rủi ro bảo mật;
(b) mất khả năng index/aggregate số dư (Json không index được theo số);
(c) phá tính bất biến của snapshot (RoleBinding là bảng mutable).

➡️ **Quyết định: NEW `LeavePolicyRef` + NEW `LeaveBalanceSnapshot`.**
Nhưng **PE PHẢI dùng `DataScope` để quyết định manager nào thấy được đơn nghỉ của ai** — không tự chế cơ chế
phạm vi thứ hai. Cụ thể: `people.team.availability.read` + `people.team.leave.approve` được lọc thêm bởi
`DataScope.scope.orgUnits` của chủ thể (xem `PE_API_ROUTE_PLAN.md` §4). Đây là **tái dùng đúng chỗ**.

---

## 3. ⭐ Giải quyết #2 — `PeopleTenantConfig` vs bảng cấu hình tenant có sẵn

**Đã tìm toàn bộ `schema.prisma`** cho bất kỳ model cấu hình tenant dạng generic. Kết quả:

| Ứng viên | Thực tế | Dùng được cho PE không? |
|---|---|---|
| `Tenant` (dòng 18) | Chỉ registry: `slug/name/tenantNo/tenantCode/tenantKey/tenantClass/industry/status/planId/blueprintId/mode`. **Không có cột config tự do.** Là bảng **shared/no-RLS**. | ❌ Không. Thêm cột nghiệp vụ HR vào registry platform = sai tầng, và bảng này không có RLS. |
| `TenantApplicationInstance` (dòng 572) | `{ tenantId, applicationCode, status, config Json }`, unique `(tenantId, applicationCode)`. Ngữ nghĩa: **tenant bật/tắt một ỨNG DỤNG trong control-plane**, `config` là tham số kết nối app đó (team code, base url). Do `src/controlplane` sở hữu. | ❌ Không. Nhét operating-mode HR vào đây trộn hai domain: control-plane provisioning ≠ chính sách nhân sự. Và `applicationCode` nào? Không có app "people". |
| `WorkflowNode.config` (dòng 94) | Config của một node trong workflow. | ❌ Không liên quan. |
| `SubscriptionPlan` / `Blueprint` / `SeedPack` | Catalog platform (gói dịch vụ, khuôn tạo tenant). | ❌ Không — đây là **khuôn khởi tạo**, không phải cấu hình vận hành thay đổi được. |

**➡️ Kết luận: KHÔNG tồn tại bảng tenant-settings generic. `PeopleTenantConfig` là NEW, hợp lệ.**

Thiết kế bắt buộc:
- Có `tenantId` + **RLS** (khác `Tenant` là no-RLS) → append vào `TENANT_TABLES`.
- `@@unique([tenantId])` — **đúng một dòng cho mỗi tenant** (singleton per tenant).
- Các enum lấy **nguyên văn** từ `contracts/people-tenant-config.schema.json` (không tự chế giá trị mới):
  `attendanceMode ∈ {XOFFICE, FRAPPE_HR, DEVICE, FILE_IMPORT}`, `leaveMode ∈ {XOFFICE, FRAPPE_HR}`,
  `payrollMode ∈ {FINERP, EXTERNAL_API, FILE_IMPORT}`.
- Là **prerequisite chéo của MỌI slice** — PE-01 phải tạo nó trước LeaveRequest (xem `PE_SCHEMA_PLAN.md` §2).

---

## 4. `ExternalEmployeeMapping` vs `AppAccountBinding`

`AppAccountBinding` (dòng 588) = "PersonProfile ↔ tài khoản trong một application đã provision qua control-plane",
`externalAccountId` là id **thật** do adapter (mock) trả về. Đây là **binding tài khoản đăng nhập**.

`ExternalEmployeeMapping` = "PersonProfile ↔ **mã nhân viên** trong hệ HR/payroll bên ngoài" — không phải tài
khoản, không đi qua provisioning, không có vòng đời enable/disable app.

**Phán quyết: NEW.** Khoá mapping **bắt buộc** là `(personId, externalSystem, externalEmployeeCode)` theo
Constitution **#14 — KHÔNG dùng email làm khoá**. Lưu ý: `PersonProfile.email` là `String?` (nullable) và
`PersonProfile.externalIdRefs Json?` đã có sẵn với ví dụ `{ "hrisEmployeeNo": null }` — **cám dỗ** là nhét
mapping vào đó. **Không làm vậy**: Json không unique-index được, không audit được, không giữ được nhiều hệ
nguồn song song với `sourceVersion`/`syncedAt`/`checksum` mà `docs/01` yêu cầu.

---

## 5. `LeaveRequest` / `AttendanceCorrectionRequest` vs `Request` (PH-02)

`Request` (dòng 1032) là **đơn từ tổng quát** của X.Office Operational (42 seed row, FSM đầy đủ, có
`RequestComment`/`RequestEvent`, màn `/office/requests` + `/office/my-requests`).

Cám dỗ: coi đơn nghỉ phép là một `Request` với `type='LEAVE'`.

**Phán quyết: NEW — KHÔNG tái dùng `Request` làm bảng lưu. Lý do:**
1. `LeaveRequest` có **ràng buộc miền cứng** mà `Request` không mô hình hoá được: khoảng thời gian
   (`startAt`/`endAt`), **kiểm tra trùng lặp** với đơn khác, **trừ số dư** `LeaveBalanceSnapshot`, tác động
   `LeaveImpactSnapshot`, người thay thế. Nhét vào `Request.payload Json` = mất index theo khoảng thời gian
   → không truy vấn được availability (chính là thứ PE-07/DT-04 cần).
2. FSM khác nhau: `Request` FSM riêng; Leave FSM có nhánh `CANCEL_REQUESTED → CANCELLED` **sau khi đã APPROVED**
   (huỷ nghỉ đã duyệt) — trạng thái này `Request` không có.
3. Constitution #4 — SoR của "một lần nghỉ" phải là **một** bảng; dùng cả hai = dual-write.

**Nhưng TÁI DÙNG phần duyệt:** bước approval của Leave đi qua `WorkflowInstance` + `ApprovalTask` + `Delegation`
đã có, để đơn nghỉ **hiện trong `/approvals` (Trung tâm phê duyệt) và `/inbox` (Hộp việc hợp nhất)** như mọi
việc khác — không tạo hàng đợi duyệt thứ hai. Chi tiết ở `PE_SOR_MATRIX_DELTA.md` §4.

---

## 6. `PayrollImportBatch` vs `ImportJob` (MDM)

`ImportJob` (dòng 760) thuộc **Shared MDM Hub**, phục vụ nạp `SourceRecord` → `MasterRecord` (khách hàng, dự
án…). Ngữ nghĩa: hợp nhất master data đa nguồn + dedup (`DuplicatePair`).

`PayrollImportBatch` phục vụ nạp **file lương/công có template version + checksum + preview + row errors +
rollback** (Constitution #15) — vòng đời `UPLOADED → VALIDATING → INVALID|READY → APPROVED → PUBLISHED →
SUPERSEDED|ROLLED_BACK`, hoàn toàn khác.

**Phán quyết: NEW.** Nhưng **bắt buộc học lại guard đã có**: `blueprint-catalog-seed.mjs:26` chặn field
secret-like bằng `SECRET_FIELD_REGEX` → ném `MUST_NOT_LEAK`. Import lương **phải áp cùng guard** (không cho
field kiểu `password`/`token` lọt vào payload/preview).

---

## 7. `PayrollQuestion` vs `Ticket` (Service Desk)

`Ticket` + `ServiceCatalogItem` + `TicketEvent` đã có FSM `NEW→…→RESOLVED→CLOSED` + CSAT + SLA + hàng đợi,
màn `/office/service-desk`.

**Phán quyết: TÁI DÙNG `Ticket`, KHÔNG tạo `PayrollQuestion`.** Một câu hỏi về phiếu lương **chính xác là** một
ticket: có người hỏi, có hàng đợi payroll xử lý, có SLA, có trạng thái đóng. Cách làm:
- Thêm một `ServiceCatalogItem` mã `PAYROLL_QUESTION` (dữ liệu, không phải schema).
- `Ticket.sourceContext`/liên kết mang `payslipProjectionId`.
- ⚠️ **Ràng buộc bảo mật bổ sung:** Constitution #8 — payslip chỉ chủ thể + payroll role được xem. Ticket
  hiện **không** có lớp che nội dung theo owner. Vì vậy: **nội dung phiếu lương KHÔNG được copy vào ticket
  body**; ticket chỉ mang **con trỏ** (`payslipProjectionId`) và người xử lý phải có `people.hr.payslip.publish`
  hoặc `people.self.payslip.read` (nếu là chính chủ) mới resolve được con trỏ đó.
- Nếu rà soát PE-04 kết luận không thể đảm bảo che nội dung trong luồng Ticket → **fallback: tạo
  `PayrollQuestion` riêng**. Quyết định này **hoãn đến PE-04**, không chặn PE-01.

---

## 8. `PeopleSyncJob` vs `OutboxEvent` / `ProvisioningCommand`

`OutboxEvent` đã lo **phát event ra ngoài** (retry/backoff/dead-letter/reconcile).
`ProvisioningCommand` lo **lệnh provisioning control-plane** (idempotent qua `CommandLog`).

`PeopleSyncJob` của handoff định nghĩa **chiều ngược lại**: kéo/đẩy delta với FinERP/Frappe theo lô, có
`sourceVersion`/`syncedAt`/`freshness`/`checksum`.

**Phán quyết: NEW nhưng THU HẸP, và HOÃN tới PE-08.** Phát event ra ngoài **vẫn phải dùng `OutboxEvent`** —
`PeopleSyncJob` chỉ ghi *trạng thái một phiên đồng bộ* (cursor, số dòng, freshness), không được trở thành
hàng đợi event thứ hai. Vì **chưa có adapter FinERP/Frappe nào tồn tại** (xem `PE_CURRENT_STATE_DELTA.md` §4),
bảng này **không được tạo ở PE-01**.

---

## 9. Bề mặt PE **tuyệt đối không được chạm**

| Bề mặt | Chủ sở hữu | Luật cho PE |
|---|---|---|
| 104 model hiện có trong `schema.prisma` | Foundations / Work v2 / Mgmt OS / IOC | **APPEND ONLY** ở cuối file. Không sửa model cũ, không thêm relation field vào chúng. |
| `TENANT_TABLES` trong `rls-setup.mjs` **và** `rls-test.mjs` | shared | **APPEND ONLY** cuối mảng, sửa **cả hai** file. |
| `navigation.model.ts` | shared — **agent IOC đang sửa file này** | **APPEND ONLY** một mục top-level `people`. Không sửa `home/manage/work/space/office/business/platform/delivery/ioc`. Phối hợp thời điểm ghi. |
| `src/ioc/*`, `components/ioc/*` | agent IOC template-gallery (đang chạy) | **KHÔNG chạm** trong suốt PE-00→PE-06. PE-07 mới đọc/ghi data layer, và chỉ sau khi IOC gallery đóng. |
| `PersonProfile` / `OrgUnit` / `Position` / `PositionAssignment` | **Identity** | PE **chỉ tham chiếu** bằng `personId`/`orgUnitId`/`positionId` (String, không FK). **Không** thêm cột HR (ngày vào làm, hệ số lương…) vào chúng. |
| `NativeWorkItem` / `ExecutionProject` | Work v2 | PE **đọc** để tính impact/utilization. `TimeEntry` tham chiếu bằng id. **Không ghi**. |
| `StrategicObjective` / `MetricDefinition` / `MetricObservation` / `Scorecard` / OKR* / `DecisionRecord` | Management OS | PE-06 **chỉ đọc để snapshot**. Không ghi. |
| `/api/work/*`, `/api/manage/*`, `/api/ioc/*` | các domain tương ứng | PE gọi qua Prisma trong service của chính nó (cùng process, RLS-scoped), read-only. |

---

## 10. Tổng kết

- **0/29** thực thể trùng tên model.
- **2 mối nghi ngờ chính đã giải quyết:** `LeavePolicyRef`/`LeaveBalanceSnapshot` → **NEW** (khác trục ngữ
  nghĩa với `RoleBinding`/`DataScope`, nhưng **bắt buộc tái dùng `DataScope`** cho phạm vi manager);
  `PeopleTenantConfig` → **NEW** (xác nhận không có bảng tenant-settings generic nào trong 104 model).
- **1 thực thể bị loại, thay bằng tái dùng:** `PayrollQuestion` → dùng `Ticket` (quyết định cuối ở PE-04).
- **1 thực thể bị thu hẹp + hoãn:** `PeopleSyncJob` → chỉ là cursor đồng bộ, tạo ở PE-08.
- **Số bảng PE thực sự mới cho PE-01:** **6** (xem `PE_SCHEMA_PLAN.md`).
