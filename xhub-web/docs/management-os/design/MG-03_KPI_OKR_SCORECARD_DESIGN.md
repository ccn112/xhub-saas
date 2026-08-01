# MG-03 — THIẾT KẾ KPI · OKR · SCORECARD (BSC)

> Design spec để dựng nhanh các phase MOS sau khi reference slice (MetricDefinition/MetricObservation) đáp đất.
> Ground truth: `contracts/{scorecard,okr,strategic-objective,metric-definition}.schema.json`,
> `docs/05_BSC_KPI_OKR_MODEL.md`, `data/OKR_SEED.csv`, `data/STRATEGY_OBJECTIVE_SEED.csv`,
> `management-os/MANAGEMENT_SOR_MATRIX_DELTA.md`, `management-os/MANAGEMENT_UI_ROUTE_PLAN.md`.
> Docs-first: KHÔNG code, KHÔNG sửa schema.prisma / navigation.model.ts trong spec này.

## 1. Mục đích & phạm vi

Thiết kế ba lớp quản trị chiến lược **phân biệt tuyệt đối** (Constitution #3, #9):

- **Scorecard (BSC)** — khung mô tả chiến lược qua 4 perspective; **tham chiếu** Objective, không chứa KPI thô.
- **StrategicObjective** — mục tiêu chiến lược định tính, có owner + perspective; **link** metric & initiative.
- **OKR (OKRCycle / Objective / KeyResult)** — mục tiêu tham vọng theo chu kỳ; KR là outcome định lượng, **link Initiative/Action chứ KHÔNG phải task list**.
- **KPI tree** — cây chỉ số sức khỏe/hiệu suất **layered trên `MetricDefinition`** của reference slice; KPI KHÔNG tự định nghĩa lại metric.

Ranh giới bắt buộc (doc 05 + #9): **BSC ≠ KPI ≠ OKR ≠ task list**. OKR dùng cho thay đổi ưu tiên/outcome tham vọng, KHÔNG ghi mọi BAU task. KPI theo dõi sức khỏe lặp lại. Scorecard mô tả & cân bằng, không trở thành danh mục hàng trăm chỉ số.

## 2. Entity + trường chính + enum

Tất cả entity Mgmt-owned (SoR = X.Office Management, per SOR_MATRIX_DELTA §1). Mọi entity có `tenantId` (RLS: tenantId + rls-setup.mjs).

### 2.1 Scorecard  (`contracts/scorecard.schema.json`)
| Trường | Kiểu | Ghi chú |
|---|---|---|
| id, tenantId, name, period | string (req) | `period` vd `2026Q3` |
| perspectives[] (req, ≥1) | array | mỗi item: `code`, `name`, `objectiveIds[]` |
| perspectives[].objectiveIds[] | string[] | **tham chiếu `StrategicObjective.id`** — KHÔNG nhúng KPI vào scorecard |

Perspective mặc định (doc 05): `FINANCIAL` (Financial/Value), `CUSTOMER` (Customer/Stakeholder), `PROCESS` (Internal Process), `LEARNING` (Learning/Capability). Tenant có thể thêm `SUSTAINABILITY`/`RISK` nhưng không lạm dụng.

### 2.2 StrategicObjective  (`contracts/strategic-objective.schema.json`)
| Trường | Kiểu | Ghi chú |
|---|---|---|
| id, tenantId, code, name, ownerId | string (req) | code vd `ST-GROWTH` |
| status | enum | `DRAFT · ACTIVE · AT_RISK · ACHIEVED · CANCELLED · ARCHIVED` |
| perspective | string | map tới code perspective của Scorecard |
| parentObjectiveId | string? | cây cascade objective (theme → objective con) |
| linkedMetricIds[] | string[] | **→ `MetricDefinition.id`** (không copy giá trị) |
| linkedInitiativeIds[] | string[] | **→ `Initiative.id`** (xem MG-04) |
| reviewCadence | string | vd `MONTHLY`/`QUARTERLY` |

### 2.3 OKRCycle
| Trường | Kiểu | Ghi chú |
|---|---|---|
| id, tenantId | string | |
| code | string | vd `2026Q3` (khớp `period` scorecard) |
| name, startDate, endDate | | khung thời gian chu kỳ |
| status | enum | `PLANNING · ACTIVE · GRADING · CLOSED` |

### 2.4 OKR Objective + KeyResult  (`contracts/okr.schema.json`)
| Trường | Kiểu | Ghi chú |
|---|---|---|
| id, tenantId, cycleId, objective, ownerId | (req) | `cycleId` → OKRCycle; `objective` là chuỗi định tính |
| status | enum (req) | `DRAFT · ACTIVE · AT_RISK · ACHIEVED · CANCELLED · CLOSED` |
| confidence | number 0..1 | mức tin đạt outcome (doc 05) |
| keyResults[] (req, ≥1) | array | mỗi KR: `id, description, baseline, target, current, unit`, `evidenceUrl?` |
| strategicObjectiveIds[] | string[] | **link OKR ↔ StrategicObjective** (alignment) |

**KeyResult check-in** (append-only, không nằm trong contract JSON — thêm ở data model phase):
`{ id, keyResultId, at, value (→ ghi vào current), confidence, note (learning note), authorId, evidenceUrl? }`. `current` của KR có thể **map từ `MetricObservation`** (đọc, không ghi ngược — SOR_MATRIX §1 dòng OKR).

**RÀNG BUỘC #9:** KeyResult link tới **Initiative/ActionCommitment** (việc tác động KR), **KHÔNG** chứa danh sách task thô. Việc thật sống ở `NativeWorkItem` (SoR Work). OKR nắm outcome + confidence + learning note, không nắm tiến độ task.

### 2.5 KPI tree (layered trên MetricDefinition — KHÔNG entity metric mới)
KPI KHÔNG định nghĩa lại metric. Một "KPI node" = **projection/wrapper** trỏ `metricCode` → `MetricDefinition` (đã có `formula`, `formulaVersion`, `unit`, `direction UP/DOWN/RANGE/ZERO`, `ownerId`, `sourceSystem`, `frequency`, `freshnessSlaMinutes`, `dimensions[]`). KPI tree bổ sung lớp trình bày quản trị:
| Trường KPI node | Ghi chú |
|---|---|
| metricCode (req) | **→ MetricDefinition.code** (không copy công thức) |
| objectiveId / processId | KPI phải link objective hoặc process (doc 05) |
| baseline, target, threshold band | ngưỡng đỏ/vàng/xanh cho kỳ |
| playbookId | playbook khi lệch ngưỡng |
| parentKpiId | cấu trúc cây phân rã |
| status (derived) | `GREEN · YELLOW · RED · STALE` tính từ observation + threshold + freshness |

## 3. Endpoints (xhub-api BFF, `/xoffice` hoặc `/manage` namespace — theo convention hiện có)

Read từ certified read model cho giá trị; ghi chỉ vào entity Mgmt-owned. Không dual-write (#12).

```
# Scorecard
GET  /manage/scorecards                 list (tenant-scoped)
GET  /manage/scorecards/:id             gồm perspectives → resolve objectiveIds
POST /manage/scorecards                 create (validate scorecard.schema)
PATCH/manage/scorecards/:id             sửa perspectives/objectiveIds

# StrategicObjective
GET  /manage/objectives                 tree (parentObjectiveId)
POST /manage/objectives · PATCH /:id
POST /manage/objectives/:id/links       gắn metricIds / initiativeIds

# OKR
GET  /manage/okr-cycles · POST ...
GET  /manage/okrs?cycleId=              list Objective+KR
POST /manage/okrs                       create (validate okr.schema, KR ≥1)
POST /manage/okrs/:id/key-results/:krId/checkin   check-in (value, confidence, note, evidenceUrl)
PATCH/manage/okrs/:id                    status/confidence

# KPI (đọc definition từ slice, giá trị từ observation)
GET  /manage/kpis?objectiveId=          KPI tree + trạng thái derived
GET  /manage/kpis/:metricCode/series    time series từ MetricObservation (read model)
```

## 4. UI routes (dưới `/manage`, workspace `manage` — UI_ROUTE_PLAN §3)

| Route | Màn | Permission |
|---|---|---|
| `/manage/scorecards` | Thẻ điểm BSC: 4 perspective, mỗi cột list Objective + trạng thái tổng hợp | `scorecard.read` |
| `/manage/objectives` | Cây StrategicObjective + link metric/initiative | `objective.read` |
| `/manage/okrs` | OKR theo cycle: Objective, KR (baseline→current→target), confidence, check-in timeline | `okr.read` |
| `/manage/metrics` | KPI tree layered trên MetricDefinition (thuộc slice/MG-05) | `metric.read` |

**Quy tắc trình bày #5 (không che KPI đỏ):** Scorecard/OKR KHÔNG hiển thị **một điểm blended duy nhất** che giấu KPI critical đang đỏ. Perspective rollup phải hiện **worst-of / danh sách red items** cạnh mọi điểm tổng hợp; KR "achieved" nhưng KPI liên quan đỏ → cảnh báo mâu thuẫn. Mỗi KPI node hiện `direction` + threshold band + freshness (stale = không xanh giả).

## 5. Seed

Từ `data/STRATEGY_OBJECTIVE_SEED.csv` → 4 StrategicObjective: `ST-GROWTH` (Financial/Value, CEO), `ST-CUSTOMER` (Customer, CCO), `ST-OPS` (Internal Process, COO), `ST-CAP` (Learning/Capability, CIO).

Một Scorecard `period=2026Q3` với 4 perspective, `objectiveIds` trỏ 4 objective trên.

Từ `data/OKR_SEED.csv` → OKRCycle `2026Q3` + 2 Objective, 4 KeyResult:
- **O-001** "Đưa XHub thành hệ điều hành quản trị chạy thật tại X-TECH" → link `ST-CAP`/`ST-OPS`
  - KR-001 pre-read chứng nhận: baseline 0 → target 100 (%)
  - KR-002 giảm giờ chuẩn bị báo cáo: 16 → 4 (hours, direction DOWN)
- **O-002** "Tăng tính dự báo của danh mục triển khai" → link `ST-OPS`
  - KR-003 dự án có baseline+forecast: 20 → 90 (%)
  - KR-004 giảm action quá hạn sau review: 35 → 10 (%, DOWN)

KPI seed layered trên MetricDefinition tương ứng (từ `KPI_DICTIONARY_SEED.csv` khi slice có metric code).

## 6. Test plan

- **Validation:** payload sai schema (KR rỗng, thiếu objectiveIds) bị Ajv từ chối.
- **Distinctness #3/#9:** không thể tạo KR gắn trực tiếp `NativeWorkItem` như "task list"; KR chỉ link Initiative/Action.
- **#5 no blended hide:** test scorecard có 1 KPI RED → rollup perspective KHÔNG hiện GREEN; red item luôn nổi lên.
- **Read-only observation:** KR.current lấy từ MetricObservation là read; ghi vào observation phải fail (không dual-write).
- **RLS:** tenant A không thấy scorecard/OKR tenant B (rls-setup.mjs, canary tenant).
- **Freshness:** metric quá `freshnessSlaMinutes` → KPI status `STALE`, không xanh.
- **Check-in:** append-only; check-in mới cập nhật `current` + confidence, giữ lịch sử.

## 7. Constitution guards

- **#3** BSC/KPI/OKR/task tách bạch — 4 store/khái niệm riêng, không gộp.
- **#5** không một điểm tổng che KPI đỏ; data quality/freshness hiển thị.
- **#9** KPI≠OKR≠task list — KR link Initiative/Action, việc thật ở NativeWorkItem.
- **#12** không direct-DB/dual-write — giá trị metric từ certified read model, Mgmt chỉ sở hữu *định nghĩa* + *mục tiêu*.

## 8. LINKS tới entity đã tồn tại (KHÔNG nhân đôi)

- KPI node → **`MetricDefinition`** (reference slice) qua `metricCode`; giá trị ← **`MetricObservation`** (read model).
- StrategicObjective.linkedInitiativeIds → **`Initiative`** (MG-04).
- KeyResult / ActionCommitment → **`NativeWorkItem`** (Work v2, SoR Work) — link, không copy trạng thái.
- OKR/Objective → Scorecard qua `objectiveIds` (một chiều tham chiếu).
