# MANAGEMENT OS — DOMAIN COLLISION MAP (MG-00)

> Với TỪNG thực thể MOS mới (23 thực thể `ENTITY_CATALOG`), quyết định **REUSE** (dùng lại model có sẵn) /
> **ADD-NEW** (thêm model mới) / **LINK** (nối bằng FK/reference, KHÔNG dual-write, KHÔNG copy).
> Verify với `xhub-api/prisma/schema.prisma` (81 model), `scripts/rls-setup.mjs`, nav, và các route `(app)/*`.
> Ràng buộc Constitution: **#3** BSC≠KPI≠OKR≠project≠process≠meeting (không nhập nhằng) ·
> **#9** KPI vận hành≠OKR≠task list · **#13** tôn trọng phân tách `WorkflowTask`(=`ApprovalTask`) /
> `NativeWorkItem` / `UnifiedWorkItem` và `CanonicalProject`(=`MasterRecord domain=PROJECT`) / `ExecutionProject`.

## 0. Nguyên tắc chống nhập nhằng (Constitution #3/#9)
Sáu tầng khái niệm KHÁC NHAU, mỗi tầng một aggregate riêng, không cái nào "biến thành" cái kia:

```
StrategicObjective  ≠  MetricDefinition(KPI)  ≠  Objective/KeyResult(OKR)
   (định hướng)          (đo lường vận hành)        (khát vọng theo chu kỳ)
Initiative/ExecutionProject  ≠  ProcessDefinition  ≠  MeetingInstance
   (đầu tư/thực thi)             (quy trình lặp)        (governance object)
```
- KPI **không** được nhét làm KeyResult (số vận hành ≠ khát vọng) — #9.
- Meeting **không** phải lịch/file — là object điều hành có pre-read/agenda/decision/action/follow-up (#7).
- Project phải có strategic linkage + value case + benefit owner + exit criteria (#8).

## 1. Bảng quyết định collision cho 23 thực thể MOS

Ký hiệu: **ADD-NEW** · **REUSE** · **LINK** (FK, no dual-write). Tất cả **non-destructive**.

### 1.1 Strategy
| Thực thể MOS | Va chạm | Quyết định | Cách làm |
|---|---|---|---|
| `StrategicTheme` | — | ADD-NEW | Model mới, Mgmt SoR. Tenant-scoped RLS. |
| `StrategicObjective` | Nhầm với `Directive`/KPI | ADD-NEW | Mới. `parentObjectiveId` self-ref; `linkedMetricIds[]`/`linkedInitiativeIds[]` là **reference** (không nhúng). Status `DRAFT/ACTIVE/AT_RISK/ACHIEVED/CANCELLED/ARCHIVED`. **KHÔNG** trộn với Directive (chỉ đạo tác nghiệp ≠ mục tiêu chiến lược). |

### 1.2 Performance (BSC/KPI/OKR)
| Thực thể | Va chạm | Quyết định | Cách làm |
|---|---|---|---|
| `Scorecard` | — | ADD-NEW | Mới. `perspectives[{code,name,objectiveIds[]}]` chỉ **tham chiếu** StrategicObjective. BSC ≠ danh sách KPI (#3). |
| `MetricDefinition` | Nhầm dashboard seed hiện có | ADD-NEW | Mới, Mgmt SoR. Bắt buộc `formula,unit,direction{UP/DOWN/RANGE/ZERO},ownerId,sourceSystem,frequency` (Constitution #5). |
| `MetricObservation` | Dual-write với SoR nghiệp vụ | ADD-NEW là **read model** | Quan sát/điểm dữ liệu **lấy từ connector/certified read model** của SoR (FinERP/X2-BMS/XBooking/Work), **KHÔNG** ghi ngược, **KHÔNG** direct-DB (#12). |
| `OKRCycle` / `Objective`(OKR) / `KeyResult` | Nhầm KPI, nhầm task | ADD-NEW | Mới. `keyResults[{baseline,target,current,unit}]`, `confidence 0-1`. KR **không** phải WorkItem; KR đo kết quả, task đo hoạt động (#9). |

### 1.3 Portfolio / Delivery — ĐÂY LÀ CHỖ LINK QUAN TRỌNG NHẤT
| Thực thể | Va chạm | Quyết định | Cách làm |
|---|---|---|---|
| `Portfolio` | — | ADD-NEW | Mới, nhóm Initiative. |
| **`Initiative`** | ↔ **`ExecutionProject` (ĐÃ CÓ)** | **ADD-NEW + LINK** | `Initiative` (Mgmt SoR: value case, sponsor, `expectedBenefits[]`, `strategicObjectiveIds[≥1]`, status `INTAKE…CLOSED/STOPPED`) mang cột **`executionProjectId?` (nullable)** → trỏ `ExecutionProject.id` đã có. **KHÔNG tạo project engine thứ 2.** Initiative = tầng đầu tư/benefit; ExecutionProject = tầng kế hoạch/thực thi (WBS/baseline/health đã build ở Work W2). |
| `BenefitProfile` | — | ADD-NEW | Mới. Benefit owner + realization; đối chiếu `MetricObservation` để đo hiện thực hoá lợi ích (#8). |
| **`ExecutionProject`** | — | **REUSE (đã tồn tại)** | `schema.prisma:1748`. Có sẵn `projectKind{INTERNAL/IMPLEMENTATION/…}`, `canonicalProjectId?`→MDM, `sourceRef`, baseline, health. MG chỉ **đọc/link**, không đổi cột. |
| **`NativeWorkItem`** | — | **REUSE (đã tồn tại)** | `schema.prisma:1627`. Có sẵn `type` gồm **`FOLLOW_UP`**, `sourceContext` (origin directive/ticket/request), `dimensions`. Là đích của Action/Commitment. |

### 1.4 Review / Meeting / Decision — governance objects (KHÔNG cạnh tranh Calendar/X.Space)
| Thực thể | Va chạm | Quyết định | Cách làm |
|---|---|---|---|
| `BusinessReview` | Nhầm dashboard | ADD-NEW | Mới. `type{DAILY…QUARTERLY_STRATEGY,PIR}`, gắn `metricSnapshotIds[]` + `meetingInstanceId` + `decisionIds[]` + `actionIds[]` (→NativeWorkItem). Là "vỏ" nhịp rà soát (#7). |
| `MeetingSeries` / `MeetingInstance` | ↔ **Calendar `/work/calendar`, X.Space huddles, `Booking`** | ADD-NEW + LINK | ⚠️ **KHÔNG thay Calendar/X.Space.** MeetingInstance là **executable governance object**: `agendaItems[{type INFORM/DISCUSS/DECIDE/SOLVE/LEARN, decisionQuestion?}]`, liên kết pre-read↔decision↔action. Thời điểm/phòng họp vẫn do Calendar/`Booking`/X.Space huddle nắm; MeetingInstance chỉ **tham chiếu** (link), không sở hữu lịch. |
| `DecisionRecord` | ↔ **`Directive` (chỉ đạo)** | ADD-NEW + LINK | Mới. `question,deciderId,decision,status{PROPOSED…REVERSED},options[{pros,cons}],evidenceRefs[]`. **Directive ≠ Decision**: Directive là mệnh lệnh tác nghiệp có SLA; DecisionRecord ghi **quyền quyết định (RAPID) + lý do + bằng chứng**. Một DecisionRecord có thể **sinh** Directive hoặc Action — link, không gộp. |
| `ManagementCadence` | Nhầm scheduler | ADD-NEW | Mới. `frequency{DAILY…EVENT}`, `requiredOutputs[DECISION/ACTION/RISK/…]`. Định nghĩa nhịp; instance thực thi là BusinessReview/MeetingInstance. |

### 1.5 Decision→Action bridge
| Thực thể | Va chạm | Quyết định | Cách làm |
|---|---|---|---|
| **`ActionCommitment`** | ↔ **`NativeWorkItem` (ĐÃ CÓ)** + `Directive` | **ADD-NEW mỏng + LINK** | Bridge: Action/cam kết từ họp/quyết định trở thành việc thật = **link tới `NativeWorkItem`** (tái dùng pattern `WorkLink{kind,refId}` của Work v2). Có thể link `Directive` khi cam kết mang tính chỉ đạo. **KHÔNG** tạo bảng task thứ 3 (#13). SoR = "X.Office Management / linked Work". |

### 1.6 Operations / Risk / Intelligence
| Thực thể | Va chạm | Quyết định | Cách làm |
|---|---|---|---|
| `ProcessDefinition` | ↔ **`Workflow`/`WorkflowVersion` (đã có)** | ADD-NEW + LINK | Mgmt-level "quy trình có owner/measure" (#2); **không** thay engine workflow. Link tới `Workflow` khi được số hoá thành runtime. |
| `Risk` | Owning domain vs Mgmt | ADD-NEW (+ projection) | Risk sống ở domain sở hữu; Mgmt giữ **projection** cho review/cockpit. KRI đo qua `MetricObservation`. |
| `Control` | — | ADD-NEW | Mới, gắn Risk. |
| `DashboardDefinition` | ↔ dashboards seed `/home/*`,`/reports` | ADD-NEW | Mới, Mgmt SoR. Bắt buộc `audienceRoles[≥1]` + `decisionQuestions[]` + `widgets[{drillThroughRoute?,actionPlaybookId?}]` (Constitution #4: cấm vanity dashboard — mọi widget dẫn tới drill/exception/decision/action). |
| `ManagementAlert` | Dual-write | ADD-NEW là **read model** | Sinh từ ngưỡng metric (read model), không ghi ngược SoR. |

## 2. Ba tầng "task" và hai khái niệm "project" — giữ nguyên (Constitution #13)
| Tầng | Model thực tế | MG dùng thế nào |
|---|---|---|
| Process-runtime | `ApprovalTask` (handoff gọi `WorkflowTask`) | KHÔNG đụng. |
| PM entity | `NativeWorkItem` | Đích của `ActionCommitment` (LINK). |
| Projection | `UnifiedWorkItem` | Read-model inbox; MG action hiện qua đây nếu cần. |
| CanonicalProject | `MasterRecord(domain=PROJECT)` | MDM master; `ExecutionProject.canonicalProjectId` link. |
| ExecutionProject | `ExecutionProject` | Đích của `Initiative.executionProjectId` (LINK). |

## 3. Tổng kết quyết định link then chốt
- **Initiative ↔ ExecutionProject**: LINK qua `Initiative.executionProjectId` — **không rebuild** engine PM.
- **ActionCommitment ↔ NativeWorkItem**: LINK (tái dùng `WorkLink`) — **không tạo bảng task thứ 3**.
- **Meeting ↔ Calendar/X.Space/Booking**: LINK (governance object tham chiếu lịch) — **không thay Calendar**.
- **DecisionRecord ↔ Directive**: LINK — Decision ghi quyền/lý do/bằng chứng; Directive là mệnh lệnh tác nghiệp.
- **Metric/Observation/Alert**: read model từ connector — **no dual-write, no direct DB** (#12).
