# MG-04 — THIẾT KẾ PORTFOLIO · INITIATIVE · BENEFIT

> Design spec cho lớp **đầu tư/benefit** trên danh mục — góc nhìn quản trị, KHÔNG dựng lại PM engine.
> Ground truth: `contracts/initiative.schema.json`, `docs/07_PORTFOLIO_PROGRAM_PROJECT_GOVERNANCE.md`,
> `data/PORTFOLIO_PROJECT_SEED.csv`, `management-os/MANAGEMENT_SOR_MATRIX_DELTA.md`,
> `management-os/MANAGEMENT_UI_ROUTE_PLAN.md §2`. Hiện trạng: `ExecutionProject`/`NativeWorkItem` đã tồn tại (Work v2).
> Docs-first: KHÔNG code, KHÔNG sửa schema.prisma.

## 1. Mục đích & phạm vi

Quản trị **"chọn đúng dự án"** (doc 07), tách bạch với **"làm dự án đúng"** (Work v2 đã lo). MOS bổ sung lớp:

- **Portfolio** — nhóm đầu tư theo chủ đề chiến lược; đo cân đối & ưu tiên.
- **Initiative** — đơn vị đầu tư có value case, sponsor, benefit owner, gate; **link xuống một `ExecutionProject`** khi vào Delivery.
- **BenefitProfile** — hồ sơ lợi ích kỳ vọng vs thực nhận, đo qua MetricObservation.

**KHÔNG rebuild PM engine:** WBS, milestone, tiến độ, health, baseline, task — tất cả sống ở `ExecutionProject`/`NativeWorkItem` (Work v2). MG-04 chỉ nắm **quyết định đầu tư & benefit**, đọc tiến độ từ Work, không ghi vào Work (SOR_MATRIX §1: ExecutionProject = Linked SoR, "MG đọc, không ghi").

## 2. THE KEY LINK — một SoR, hai lăng kính

`Initiative.executionProjectId?` → **`ExecutionProject.id`** (trường đã có trong `initiative.schema.json`).

```
Strategic Theme → Portfolio → Program/Initiative → ExecutionProject → Milestone/NativeWorkItem   (doc 07 hierarchy)
                              └─ MG-04 sở hữu ─┘   └────── Work v2 sở hữu (đã có) ──────┘
```

| Lăng kính | Route | SoR | Nắm gì |
|---|---|---|---|
| **Delivery / PM** | `/work/portfolio`, `/work/projects/[id]` | `ExecutionProject` (Work v2) — GIỮ NGUYÊN | tiến độ, health, WBS, baseline, task |
| **Đầu tư / Benefit** | `/manage/portfolio` | `Initiative` (Mgmt-owned) | value case, strategic linkage, gate, expectedBenefits |

**Quy tắc một-portfolio-một-nguồn (UI_ROUTE_PLAN §2):** hai màn nhìn **cùng một `ExecutionProject`** từ hai lớp. `/manage/portfolio` **KHÔNG** query project theo đường riêng — luôn qua `Initiative.executionProjectId` rồi deeplink `/work/projects/[id]` ("Xem thực thi"). Không nhân đôi dữ liệu tiến độ.

## 3. Entity + trường chính + enum

### 3.1 Initiative  (`contracts/initiative.schema.json`)
| Trường | Kiểu | Ghi chú |
|---|---|---|
| id, tenantId, name, ownerId, sponsorId | string (req) | sponsor bắt buộc (entry gate doc 07) |
| status | enum (req) | `INTAKE · DISCOVERY · APPROVED · FUNDED · DELIVERY · BENEFIT_REVIEW · CLOSED · STOPPED` |
| strategicObjectiveIds[] (req, **≥1**) | string[] | **→ StrategicObjective.id** — không có strategic linkage thì không vào portfolio |
| expectedBenefits[] | array | mỗi item: `name, target, unit, ownerId` (benefit owner bắt buộc) |
| executionProjectId | string? | **→ ExecutionProject.id** (THE KEY LINK; null cho tới khi vào Delivery) |
| description | string | problem/opportunity, scope hypothesis |

> Enum status map với stage gate doc 07: Intake→`INTAKE`, Discovery/Business case→`DISCOVERY`, Approved/Funded→`APPROVED`/`FUNDED`, Delivery→`DELIVERY`, Benefit realization→`BENEFIT_REVIEW`, Closure→`CLOSED`, Stop/kill→`STOPPED`.

### 3.2 Portfolio
| Trường | Kiểu | Ghi chú |
|---|---|---|
| id, tenantId, code, name | | code vd `PF-DIGITAL` |
| ownerRole | string | vd CIO/CCO |
| strategicThemeId | string? | link theme |
| itemIds[] | string[] | → Initiative.id (thành viên portfolio) |

### 3.3 BenefitProfile
| Trường | Kiểu | Ghi chú |
|---|---|---|
| id, tenantId, initiativeId | | → Initiative |
| benefitName, unit, baseline, target | | |
| metricCode | string? | **→ MetricDefinition.code** — benefit đo qua MetricObservation (read), không nhập tay giá trị thực |
| ownerId | string | benefit owner |
| realizationSchedule[] | array | mốc kỳ vọng nhận benefit theo thời gian |
| status | enum | `PLANNED · TRACKING · REALIZED · MISSED` (derived từ observation vs target) |

## 4. Prioritization & stage gates (doc 07)

**Prioritization dimensions** (chấm điểm khi Discovery/Approved, hiển thị ở /manage/portfolio matrix):
strategic contribution · customer/business value · mandatory/risk reduction · time criticality · feasibility/readiness · resource demand · dependency · confidence.
→ Lưu dạng `Initiative.prioritization = { dimension: score }` (JSON, phase sau). KHÔNG rút gọn thành một điểm che rủi ro — hiện điểm theo chiều + confidence riêng.

**Entry gate** — Initiative vào portfolio chỉ khi đủ: strategic linkage (≥1 objectiveId), problem/opportunity, expected outcome/value (expectedBenefits), sponsor + benefit owner, scope hypothesis, cost/capacity range, risk/dependency, success/exit criteria.

**Stage gates** (chuyển status phải qua gate review): Idea/Intake · Discovery/Business case · Approved/Funded · Planning · Delivery · Transition/Go-live · Benefit realization · Closure/Archive. Mỗi chuyển status ghi vào audit + (khi có) DecisionRecord (MG-10).

## 5. Endpoints

```
# Portfolio
GET  /manage/portfolios · GET /:id (gồm initiatives + rollup ưu tiên/benefit)
POST /manage/portfolios · PATCH /:id

# Initiative
GET  /manage/initiatives?portfolioId=&status=
POST /manage/initiatives            create (validate initiative.schema; ≥1 strategicObjectiveId)
PATCH/manage/initiatives/:id        sửa value case, prioritization scores
POST /manage/initiatives/:id/gate   chuyển stage gate (INTAKE→...→CLOSED), ghi audit/decision
POST /manage/initiatives/:id/link-project   set executionProjectId (link ExecutionProject đã có; KHÔNG tạo mới project ở đây)
GET  /manage/initiatives/:id/delivery        đọc tiến độ/health từ ExecutionProject (read-only, qua API Work)

# Benefit
GET  /manage/initiatives/:id/benefits
POST /manage/benefit-profiles · PATCH /:id
GET  /manage/benefit-profiles/:id/realization   actual từ MetricObservation (read model)
```

**Ràng buộc:** `link-project` chỉ **gắn** vào `ExecutionProject` đã tồn tại (do Work v2 tạo). MG-04 KHÔNG có endpoint tạo/sửa project, milestone, task.

## 6. UI routes

| Route | Màn | Permission |
|---|---|---|
| `/manage/portfolio` | Portfolio cockpit: ma trận ưu tiên (bubble strategic value × feasibility), list Initiative theo stage gate, benefit rollup | `portfolio.read` |
| `/manage/portfolio` (detail Initiative) | value case, strategicObjectiveIds, expectedBenefits, prioritization, nút **"Xem thực thi"** deeplink `/work/projects/[executionProjectId]` | `portfolio.read` |

UX: badge phân biệt "chưa link project" (executionProjectId null) vs "đang Delivery". Tiến độ/health hiển thị **đọc từ ExecutionProject**, có nhãn "nguồn: Work v2" để rõ không phải số MOS nhập.

## 7. Seed

Từ `data/PORTFOLIO_PROJECT_SEED.csv`:
- Portfolio `PF-DIGITAL` "Chuyển đổi số & AI" (CIO): Initiative "XHub Management OS" (PROGRAM, HIGH), "X2-BMS Gold Integration" (PROJECT, HIGH).
- Portfolio `PF-CUSTOMER` "Tăng trưởng khách hàng" (CCO): "XBooking Scale" (PROGRAM, MEDIUM).
- Portfolio `PF-OPS` "Vận hành nền tảng" (Platform Owner): "Tenant Launch Factory" (PROJECT, HIGH).

Mỗi Initiative: ≥1 `strategicObjectiveId` (link ST-* của MG-03), ≥1 expectedBenefit, sponsor. Khi có ExecutionProject demo tương ứng → set `executionProjectId` để minh hoạ THE KEY LINK. Nếu chưa → giữ null (trạng thái hợp lệ).

## 8. Test plan

- **Schema:** Initiative thiếu strategicObjectiveIds (min 1) hoặc sponsorId → Ajv từ chối.
- **KEY LINK:** set `executionProjectId` tới project không tồn tại/khác tenant → fail. `/manage/initiatives/:id/delivery` trả đúng tiến độ của cùng project mà `/work/projects/[id]` hiển thị (một SoR).
- **No rebuild:** không có route MOS nào tạo/sửa ExecutionProject/milestone/task.
- **Gate:** không nhảy INTAKE→DELIVERY bỏ qua APPROVED/FUNDED khi policy yêu cầu gate.
- **Benefit:** actual lấy từ MetricObservation là read; MG không ghi vào nguồn (no dual-write).
- **RLS:** portfolio/initiative cô lập theo tenant.
- **No dual data:** progressPercent chỉ có một nguồn (ExecutionProject); MG không lưu bản sao.

## 9. Constitution guards

- **#3/#9** Initiative (đầu tư) ≠ ExecutionProject (delivery) ≠ task — link, không gộp.
- **#12** không direct-DB/dual-write vào Work; đọc tiến độ qua API Work; benefit actual qua read model.
- **#5** prioritization theo nhiều chiều + confidence, không một điểm che rủi ro; benefit MISSED không bị điểm tổng che.

## 10. LINKS tới entity đã tồn tại (KHÔNG nhân đôi)

- **`Initiative.executionProjectId` → `ExecutionProject`** (Work v2) — THE KEY LINK, một SoR hai lăng kính.
- Initiative.strategicObjectiveIds → **StrategicObjective** (MG-03).
- BenefitProfile.metricCode → **MetricDefinition**; actual ← **MetricObservation** (read model).
- Delivery detail deeplink → `/work/projects/[id]` (Work v2 route, không tái dùng/không sửa).
- `NativeWorkItem` = đích của Action; MG link qua API Work, không bypass.
