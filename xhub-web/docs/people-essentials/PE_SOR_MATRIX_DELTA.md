# PEOPLE ESSENTIALS — SYSTEM OF RECORD MATRIX DELTA (PE-00)

> Ai là **System of Record (SoR)** của từng object, sau khi rebase lên trạng thái code thật.
> Thực thi Constitution **#2** (FinERP/ERPNext sở hữu payroll/thuế/bảo hiểm/hạch toán),
> **#3** (Identity/Org/Position là định danh dùng chung), **#4** (một object một SoR, không dual-write).
> Đọc kèm: `PE_DOMAIN_COLLISION_MAP.md`, `PE_CURRENT_STATE_DELTA.md` §4 (connector chưa tồn tại).

---

## 0. Ba từ vựng phải phân biệt

| Từ | Nghĩa | Ví dụ trong repo này |
|---|---|---|
| **SoR** | Nơi giữ **trạng thái chuẩn**, được phép ghi | `MetricDefinition` là SoR của định nghĩa chỉ số |
| **Read model / Projection** | Bản sao chỉ-đọc, có `sourceVersion`/`syncedAt`/`freshness`, **không được sửa tay** | `MetricObservation` (giá trị tính từ Work), `PayslipProjection` |
| **Reference** | Chỉ giữ **id** trỏ sang SoR khác, không sao chép nội dung | `StrategicObjective.linkedMetricIds`, `ActionCommitment → NativeWorkItem` |

Pattern **reference-not-embed** này đã được `manage-slice-smoke.mjs` khẳng định bằng test
("objective links the metric (**reference**)"). PE **bắt buộc** theo cùng.

---

## 1. Ma trận SoR — tầng nền (KHÔNG đổi chủ)

| Object | SoR hiện tại | PE được làm gì | Constitution |
|---|---|---|---|
| Con người (danh tính) | **Identity** — `PersonProfile` | Chỉ tham chiếu `personId`. **Không** thêm cột HR. | #3 |
| Đơn vị tổ chức | **Identity** — `OrgUnit` (`ou-exec`…`ou-platform` cho T001) | Tham chiếu `orgUnitId`. Phân giải org của một người qua `Position.holderPersonId → Position.orgUnitId`. | #3 |
| Vị trí / ghế | **Identity** — `Position` (+ lịch sử `PositionAssignment`) | Tham chiếu `positionId`. Dùng `holderPersonId != null` để đếm headcount. | #3 |
| Quyền hạn | **Identity** — `RoleBinding` + `PermissionPolicy` | Đăng ký 15 quyền `people.*` vào registry. Không tự chế cơ chế quyền. | #5 |
| Phạm vi dữ liệu | **Identity** — `DataScope` | **Bắt buộc dùng** để lọc "manager thấy đơn của ai". Không tạo cơ chế scope thứ hai. | #5 |
| Uỷ quyền thay mặt | **Workflow** — `Delegation` | Tái dùng cho "người duyệt đi vắng". **Khác** với "người thay thế công việc khi nghỉ" (xem §5). | #4 |
| Việc / dự án | **Work v2** — `NativeWorkItem`, `ExecutionProject` | Đọc để tính impact + utilization; `TimeEntry` tham chiếu id. **Không ghi.** | #4 |
| Duyệt | **Workflow** — `WorkflowInstance`, `ApprovalTask` | Đơn nghỉ đi qua đây để hiện ở `/approvals`, `/inbox`. | #4 |
| Chiến lược / KPI / OKR | **Management OS** — `StrategicObjective`, `MetricDefinition`, `MetricObservation`, `Scorecard`, `OKRCycle/Objective`, `KeyResult`, `KeyResultCheckIn` | PE-06 **chỉ đọc để snapshot bất biến**. Không ghi. | #4, #9 |
| Quyết định / cam kết | **Management OS** — `DecisionRecord`, `ActionCommitment` | PE-06 đọc làm evidence. | #4 |
| Twin / data layer | **IOC** — `TwinSite`…`DataLayerDefinition`, `DashboardDefinition` | PE-07 **cấp nguồn** cho data layer; IOC vẫn là **projection** (IOC không bao giờ là SoR). | — |
| Audit | **Foundations** — `AuditLog` | PE ghi vào đây, không tạo bảng audit riêng. | #5, #8 |
| Event ra ngoài | **Foundations** — `OutboxEvent` | Mọi `xoffice.people.*` đi qua đây. | #5 |
| Tài liệu đính kèm | **Records** — `RecordDocument`/`DocumentVersion` | `LeaveRequest.attachmentRecordIds[]` tham chiếu (theo đúng `contracts/leave-request.schema.json`). | #4 |

---

## 2. Ma trận SoR — object của People Essentials, **theo operating mode**

Ba mode từ `contracts/people-tenant-config.schema.json`. Cột **SME Lite** là mode **duy nhất ship được hôm nay**
(không có adapter FinERP/Frappe — `PE_CURRENT_STATE_DELTA.md` §4).

| Object | **SME Lite** (`leaveMode=XOFFICE`, `payrollMode=FILE_IMPORT`) | **Connected FinERP** (`leaveMode=FRAPPE_HR`, `payrollMode=FINERP`) | **Excel Bridge** (`attendanceMode=FILE_IMPORT`) |
|---|---|---|---|
| `PeopleTenantConfig` | **X.Office (SoR)** — mọi mode | X.Office | X.Office |
| `ExternalEmployeeMapping` | X.Office (SoR), có thể rỗng | X.Office (SoR) — bắt buộc, khoá `(personId, externalSystem, externalEmployeeCode)` | X.Office (SoR) |
| `WorkCalendar` / `ShiftPattern` / `ShiftAssignment` | **X.Office (SoR)** | Frappe HR (SoR) → X.Office projection | X.Office (SoR) |
| `AttendanceEvent` | X.Office (SoR, **bất biến** #7) | Thiết bị/Frappe (SoR) → X.Office lưu bản thô bất biến | File import → X.Office (SoR bản thô) |
| `AttendanceDay` | **X.Office (SoR)** — aggregate có `formulaVersion` | X.Office (SoR của aggregate) kể cả khi event từ ngoài | X.Office (SoR) |
| `AttendanceCorrectionRequest` | **X.Office (SoR)** | X.Office (SoR), đẩy delta sang ngoài qua Outbox | X.Office (SoR) |
| **`LeavePolicyRef`** | **X.Office (SoR)** — định nghĩa loại phép + accrual | **Frappe HR (SoR)** → X.Office giữ **Ref** (chỉ mã + tên + đơn vị, có `sourceVersion`) | X.Office (SoR) |
| **`LeaveBalanceSnapshot`** | **X.Office (SoR)** — tính từ policy + đơn đã duyệt | **Frappe HR (SoR)** → X.Office là **projection** (`syncedAt`, `freshness`), **không được sửa tay** | X.Office (SoR) |
| **`LeaveRequest`** | **X.Office (SoR)** ✅ | Frappe HR (SoR) → X.Office là UI + projection | X.Office (SoR) |
| **`LeaveImpactSnapshot`** | **X.Office (SoR) — mọi mode.** Đây là dữ liệu XHub-only (task/meeting/approval bị ảnh hưởng), hệ ngoài không biết. | X.Office | X.Office |
| **`OvertimeRequest`** | **X.Office (SoR)** | X.Office (SoR của *yêu cầu*); FinERP là SoR của *chi trả OT* | X.Office (SoR) |
| `TimekeepingPeriod/Row/Adjustment` | **X.Office (SoR)** | X.Office (SoR) — kể cả Connected, bảng công là đầu vào payroll | X.Office (SoR) |
| `TimekeepingExportBatch` | X.Office (SoR của lô xuất) | X.Office | X.Office |
| `TimeEntry` / `Timesheet` | **X.Office (SoR)** | X.Office (SoR) | X.Office (SoR) |
| `PayrollImportBatch` | X.Office (SoR của lô nhập) | — (dùng API sync) | X.Office (SoR của lô nhập) |
| **`PayslipProjection`** | **KHÔNG BAO GIỜ là SoR.** Luôn là **projection** (#2). Nguồn: file import. | **FinERP (SoR)** → projection | File import → projection |
| `PayslipReadReceipt` | **X.Office (SoR)** — hành vi đọc xảy ra trong XHub | X.Office | X.Office |
| Câu hỏi về lương | **`Ticket` (SoR)** — tái dùng Service Desk (Collision Map §7) | Ticket | Ticket |
| `PerformanceEvidenceSnapshot` | **X.Office (SoR)** — bất biến, snapshot từ Mgmt OS + Work | X.Office | X.Office |
| `ManagerPerformanceReview` | **X.Office (SoR)** | X.Office | X.Office |
| **`VariablePayRecommendation`** | **X.Office (SoR của KHUYẾN NGHỊ)** — **FinERP là SoR của việc ÁP DỤNG vào lương** (#2). AI chỉ soạn nháp (#10). | như trên | như trên |
| `CapacitySnapshot` / `OrgUnitCapacityProjection` | **X.Office (SoR)**; IOC đọc làm projection | X.Office | X.Office |
| `PeopleSyncJob` | không dùng | X.Office (SoR của phiên sync) — **PE-08** | X.Office |

### Ranh giới không thể vượt (Constitution #2)
X.Office **không bao giờ** là SoR của: `SalaryStructure`, thành phần lương, công thức tính lương, thuế TNCN,
bảo hiểm, bút toán, thanh toán. Không có bảng nào trong 29 thực thể PE mang các nghĩa này — **đã xác nhận**.

---

## 3. Chiều dữ liệu — không dual-write

```text
[Identity]  PersonProfile / OrgUnit / Position
      │ (đọc, tham chiếu id — KHÔNG copy)
      ▼
[People Essentials]  LeaveRequest ── ghi ──► LeaveBalanceSnapshot (SME Lite)
      │                   │
      │                   └── ghi ──► LeaveImpactSnapshot (bất biến)
      │ (đọc)                              ▲
      ├────────────────────────────────────┘  đọc NativeWorkItem / ApprovalTask / Booking / Directive
      │
      ├── phát ──► OutboxEvent (xoffice.people.leave.request.approved, availability.changed)
      │                 │
      │                 ▼
      │           [Connector PE-08]  FinERP / Frappe  (CHƯA TỒN TẠI)
      │
      └── cấp ──► CapacitySnapshot / OrgUnitCapacityProjection
                        │
                        ▼
                  [IOC]  DataLayerDefinition (projection — DT-04)
```

**Quy tắc chống dual-write, kiểm được bằng test:**
1. Ở mode `leaveMode=FRAPPE_HR`, API `POST /api/people/leave-requests` phải trả **409/400 kèm mã
   `SOR_NOT_XOFFICE`**, không được vừa ghi local vừa gọi ngoài.
2. Ở mode `payrollMode≠null`, `PayslipProjection` **không có endpoint UPDATE nội dung** — chỉ import/publish/supersede.
3. `MetricObservation`, `NativeWorkItem`, `StrategicObjective` **không bao giờ** xuất hiện trong câu lệnh
   `create/update` của bất kỳ service PE nào (grep-able trong review).

---

## 4. Quyết định: duyệt nghỉ phép chạy ở đâu?

Hai lựa chọn, cả hai đều dùng hạ tầng có sẵn:

| Phương án | Cách làm | Ưu | Nhược |
|---|---|---|---|
| **A. FSM nội bộ `LeaveRequest.status`** | PE tự quản trạng thái, tự chọn người duyệt | Đơn giản, ít phụ thuộc | Đơn nghỉ **không** hiện ở `/approvals` và `/inbox` → tạo hàng đợi duyệt thứ hai (chống lại IA hiện có) |
| **B. FSM nội bộ + spawn `ApprovalTask`** ⭐ | `LeaveRequest.status` vẫn là SoR trạng thái đơn; đồng thời tạo `WorkflowInstance` + `ApprovalTask` để việc duyệt hiện trong hàng đợi hợp nhất. Hành động duyệt ghi vào **cả hai** trong **một transaction**. | Tái dùng `/approvals`, `Delegation` (duyệt thay), SLA/nhắc/escalate đã có ở `ApprovalTask` | Cần cẩn thận: đây **không phải** dual-write vì hai bảng giữ **hai object khác nhau** (đơn nghỉ vs nhiệm vụ duyệt) |

**➡️ Khuyến nghị: phương án B**, đúng như `ActionCommitment → NativeWorkItem` mà MG-01 đã làm (một object
quản trị + một object thực thi, liên kết bằng reference, không sao chép trạng thái). `LeaveRequest` là SoR
duy nhất của *"lần nghỉ này được duyệt chưa"*; `ApprovalTask` là SoR của *"ai còn nợ một hành động duyệt"*.

---

## 5. Hai chữ "delegation" — phải tách bạch

| Khái niệm | Bảng | Nghĩa |
|---|---|---|
| **Uỷ quyền duyệt** | `Delegation` (đã có, dòng 239) | "Trong lúc tôi vắng, B được **duyệt thay** tôi" — thuộc tầng authority |
| **Người thay thế công việc** | `LeaveRequest.replacementPersonId` (mới) | "Trong lúc tôi nghỉ, B **gánh việc** của tôi" — thuộc tầng nghiệp vụ |

Hai thứ này **không được gộp**. `contracts/leave-request.schema.json` đã tách đúng (`replacementPersonId`).
Nếu người nghỉ **cũng là người duyệt**, luồng PE-01 nên **gợi ý** tạo `Delegation` tương ứng — nhưng đó là
hành động riêng, người dùng xác nhận, không tự động ghi.

---

## 6. Bảng chốt — 6 object của PE-01 và SoR

| Object PE-01 | SoR ở SME Lite | Ghi bởi | Đọc bởi |
|---|---|---|---|
| `PeopleTenantConfig` | X.Office | HR/Tenant Admin (`people.hr.timekeeping.manage`) | mọi service PE |
| `LeavePolicyRef` | X.Office | HR | Leave service, balance engine |
| `LeaveBalanceSnapshot` | X.Office | **chỉ service** (không API ghi tay) | employee, manager, capacity |
| `LeaveRequest` | X.Office | employee (create/cancel), manager (approve/reject) | `/approvals`, `/inbox`, capacity |
| `LeaveImpactSnapshot` | X.Office (**bất biến**) | chỉ service, lúc submit | UI preview, audit |
| `OvertimeRequest` | X.Office | employee, manager duyệt | bảng công (PE-03), FinERP (PE-08) |
