# PEOPLE ESSENTIALS — CURRENT STATE DELTA (Rebase Audit PE-00)

> Gate output của `/people-essentials-rebase-audit`. **Docs-only — không viết một dòng feature code nào.**
> Đối chiếu **giả định của handoff** `XHUB_XOFFICE_PEOPLE_ESSENTIALS_HANDOFF_20260801`
> với **trạng thái mã nguồn THỰC TẾ** tại `D:\Code\xhub-saas\xhub-api` (NestJS + Prisma) và
> `D:\Code\xhub-saas\xhub-web` (Next.js), verify bằng đọc file ngày **2026-08-01**.
> Nguyên tắc nguồn sự thật: **Code/schema/test thực tế > Project Status > Constitution > handoff này.**
> Bộ tài liệu anh em: `PE_DOMAIN_COLLISION_MAP.md`, `PE_SOR_MATRIX_DELTA.md`, `PE_SCHEMA_PLAN.md`,
> `PE_API_ROUTE_PLAN.md`, `PE_UI_MOBILE_PLAN.md`, `PE_TEST_PLAN.md`, `PE_IMPLEMENTATION_PLAN.md`.
> Khuôn mẫu & độ chặt: theo `docs/management-os/MANAGEMENT_OS_CURRENT_STATE_DELTA.md` (MG-00) và
> `docs/ioc-digital-twin/IOC_CURRENT_STATE_DELTA.md` (DT-00).

---

## 0. TL;DR — handoff PE **chính xác bất thường**, chỉ lệch ở 4 điểm

Khác với handoff MG (lỗi thời nặng) và handoff IOC (đếm sai RLS 57 vs 78), handoff People Essentials
`docs/00_CURRENT_STATE_REBASE.md` **đúng gần như toàn bộ**. Bảng đối chiếu từng claim:

| Claim của handoff `docs/00` | Thực tế verify được | Phán quyết |
|---|---|---|
| "SaaS 10 tenant" | ✅ `demo-tenants.params.mjs` liệt kê T002–T010 + T001 (`tenant-xtech`). `Tenant.tenantNo/tenantCode/tenantClass/mode` có thật. | **ĐÚNG** |
| "Identity/Org" | ✅ `PersonProfile`, `OrgUnit`, `Position`, `PositionAssignment`, `Group`, `RoleBinding`, `PermissionPolicy`, `DataScope`, `AssignmentResolution` — schema.prisma dòng 380–556. | **ĐÚNG** |
| "Workflow/Approval" | ✅ `Workflow`/`WorkflowVersion`/`Node`/`Edge`/`WorkflowInstance`/`ApprovalTask`/`Delegation`. | **ĐÚNG** |
| "Work/PM v2" | ✅ `NativeWorkItem`, `ExecutionProject`, `WorkDependency`, `ProjectBaseline`/`BaselineItem`, `ProjectRoleAssignment`, `CoordinationShare`, `WorkDimension` (dòng 1627–1921). API `src/work/*`, FE `/work/*` đủ 9 route. | **ĐÚNG** |
| **"Management OS MG-01→03"** | ✅ **ĐÚNG VỀ CODE ĐÃ SHIP** — xem §2, nhưng **hiểu chưa đủ về chiều sâu**. | **ĐÚNG nhưng understate** |
| "KPI/OKR ngành" | ✅ `scripts/industry-kpi-catalog.mjs`, `seed-manage-industries.mjs`, `test:manage-industry`, controller `api/manage/kpis`. | **ĐÚNG** |
| "IOC DT-01→03" | ✅ 11 bảng twin (`TwinSite`…`DashboardVersion`) + workspace `/ioc/*`. DT-04→06 deferred. | **ĐÚNG** |
| **"89 bảng RLS"** | ✅ **ĐÚNG CHÍNH XÁC — đếm được đúng 89** trong `scripts/rls-setup.mjs` `TENANT_TABLES`. | **ĐÚNG** (nhưng là moving target — xem §1) |
| "responsive web tốt" | ✅ `DEV_BACKLOG.md` mục "UI đã thêm" (mobile drawer/rail/StatCard). | **ĐÚNG** |
| "OIDC thật và connector thật chưa xong" | ✅ `src/auth/oidc/` chỉ có `mock-oidc.provider.ts`; `.env.example` `AUTH_OIDC_ENABLED=false`. Không có adapter FinERP/Frappe nào. | **ĐÚNG** |
| "DT-04 thiếu SoR capacity/availability" | ✅ **ĐÚNG NGUYÊN VĂN** — xem §3. | **ĐÚNG** |
| "rotate API key đã lộ" (blocker) | ⚠️ **VẪN CHƯA LÀM** — xem §4. Handoff nêu như việc phải làm; thực tế đến 2026-08-01 chưa ai làm. | **ĐÚNG nhưng vẫn treo** |

### ⚠️ 4 điểm lệch cần ghi nhận

1. **"89 bảng RLS" đúng nhưng là con số ĐANG DI ĐỘNG.** Một agent khác đang build **IOC Template Gallery**
   (chạm `schema.prisma`, `src/ioc/*`, `components/ioc/*`, `navigation.model.ts`) song song với audit này.
   Model `IocTemplate` (schema.prisma dòng 2462) **đã tồn tại nhưng KHÔNG có `tenantId`** → cố ý **không**
   nằm trong `TENANT_TABLES` (nó là platform catalog dùng chung, cùng loại với `ApplicationDefinition`,
   `MasterRecord`, `Tenant`, `WorkflowVersion/Node/Edge`). Vì vậy **89 vẫn đúng tại thời điểm audit**, nhưng
   PE **không được hardcode 89** trong test — xem `PE_TEST_PLAN.md` §5 (đọc động từ `TENANT_TABLES.length`).
   Tổng model Prisma hiện tại: **104**.
2. **"MG-01→03" đúng về code nhưng understate về bề mặt tích hợp cho PE-06.** Xem §2.
3. **Nav KHÔNG còn "5 workspace"** như comment trong `navigation.model.ts` vẫn ghi. Thực tế **9 mục top-level**.
   Xem §5 và `PE_UI_MOBILE_PLAN.md`.
4. **Handoff `docs/06_API_EVENTS.md` đề xuất namespace `/people/v1/*` — SAI convention của repo này.**
   Repo dùng `/api/<domain>/*` **không có version segment** (`/api/manage/*`, `/api/work/*`, `/api/ioc/*`).
   Xem `PE_API_ROUTE_PLAN.md` §1.

---

## 1. RLS — con số thực đo

- `xhub-api/scripts/rls-setup.mjs` → `TENANT_TABLES` chứa **89 phần tử** (đếm bằng parse mảng, không ước lượng).
- Cơ chế: mỗi bảng `ENABLE + FORCE ROW LEVEL SECURITY` + policy `tenant_isolation` so `"tenantId"` với GUC
  `app.current_tenant`, trừ khi `app.bypass_rls='on'`. `current_setting(...,true)` null-safe → chưa set tenant = **thấy 0 dòng**.
- Runtime: `PrismaService.withTenant(tenantId, fn)` mở interactive transaction + `set_config('app.current_tenant', …, true)`;
  `withBypass(fn)` cho seed/platform. Controller gắn `@UseInterceptors(TenantScopeInterceptor)`.
- `scripts/rls-test.mjs` giữ **danh sách SONG SONG** cùng nội dung → **thêm bảng PE phải sửa CẢ HAI file**.

**Hệ quả cho PE:** mọi bảng People Essentials có `tenantId` **bắt buộc** append vào cuối `TENANT_TABLES`
của cả `rls-setup.mjs` và `rls-test.mjs` (append-only, không chèn giữa — tránh xung đột với agent IOC đang chạy).

---

## 2. Management OS — handoff nói "MG-01→03", thực tế là gì?

**Đã SHIP thật (model + API + FE):**

| Phase | Model trong `schema.prisma` | API controller | FE route |
|---|---|---|---|
| MG-01 | `StrategicObjective` (1923), `MetricDefinition` (1947), `MetricObservation` (1983) | `api/manage/objectives`, `api/manage/metrics` | `/manage`, `/manage/objectives`, `/manage/metrics` |
| MG-02 | `BusinessReview` (2002), `DecisionRecord` (2025), `ActionCommitment` (2053) | `api/manage/reviews`, `api/manage/decisions`, `api/manage/actions` | `/manage/reviews`, `/manage/decisions` |
| MG-03 | `Scorecard` (2089), `OKRCycle` (2103), `OKRObjective` (2121), `KeyResult` (2144), `KeyResultCheckIn` (2167) | `api/manage/scorecards`, `api/manage/okr-cycles`, `api/manage/okrs`, `api/manage/kpis` | `/manage/scorecards`, `/manage/okrs` |

Test gate: `test:manage-slice` (reset + smoke), `test:manage-okr`, `test:manage-industry`.

**CHƯA có model (chỉ có design doc):** `Initiative`, `Portfolio`, `BenefitProfile` (MG-04),
`ManagementAlert` (MG-05), `ProcessDefinition`/`Risk`/`Control` (MG-06).
Design specs tồn tại tại `docs/management-os/design/MG-03_…`, `MG-04_PORTFOLIO_BENEFIT_DESIGN.md`,
`MG-07_AI_COPILOT_DESIGN.md` — **thiết kế đi tới MG-07, code dừng ở MG-03.**

> ✅ **Đính chính trung thực:** claim "MG-01→03" của handoff **KHÔNG undercount về code đã ship** — nó khớp
> chính xác. Điều handoff **không nói ra** là MG-03 đã **hoàn chỉnh** (Scorecard + OKR đầy đủ cycle/objective/
> key-result/check-in + KPI ngành), chứ không phải một lát mỏng MG-01/02.

### Hệ quả then chốt cho **PE-06 Performance Bridge**

Bề mặt tích hợp của PE-06 **rộng hơn** giả định "MG-01/02 mỏng":

| Nguồn evidence PE-06 cần | Thực thể THẬT có sẵn để đọc (read-only, không dual-write) |
|---|---|
| Mục tiêu chiến lược của người/đơn vị | `StrategicObjective` (`ownerId`, `perspective`, `status`, `linkedMetricIds`) |
| KPI có giá trị đo được | `MetricDefinition` (certified SoR: formula/unit/direction/threshold) + `MetricObservation` (**read model**) |
| OKR cá nhân/nhóm | `OKRCycle` → `OKRObjective` → `KeyResult` → `KeyResultCheckIn` (có lịch sử check-in để làm evidence theo thời điểm) |
| Scorecard theo kỳ (BSC) | `Scorecard(period, perspectives)` |
| Chất lượng quyết định & cam kết | `DecisionRecord` (RAPID) + `ActionCommitment` (đã bridge sang `NativeWorkItem`) |
| Khối lượng/kết quả thực thi | `NativeWorkItem` (`status`, `dueAt`, `completedAt`, `progressPercent`, `weight`, `estimateMinutes`), `ExecutionProject` |

➡️ **PE-06 KHÔNG phải xây engine đo lường nào cả.** Nó tạo `PerformanceEvidenceSnapshot` **bất biến** — một
"chụp ảnh" các thực thể trên tại thời điểm review — rồi `ManagerPerformanceReview` + `VariablePayRecommendation`.
Constitution #9 (chấm công ≠ KPI) và MG Constitution #5 (không blended score che KPI đỏ) **cộng dồn**: evidence
snapshot phải giữ **từng chỉ số riêng biệt + nguồn + thời điểm**, không được gộp thành một điểm số duy nhất.

---

## 3. IOC Digital Twin — DT-04 bị chặn vì đúng cái PE-07 sẽ cấp

`docs/ioc-digital-twin/IOC_CURRENT_STATE_DELTA.md` §1 ghi **nguyên văn**:

> "`PersonPresence` / `PositionCapacity` / `SkillCoverage` entities do not exist. `DL-HEADCOUNT`, `DL-CAPACITY`,
> `DL-SKILL` from `data/DATA_LAYER_CATALOG.csv` have no System of Record today. Headcount is derivable from
> `Position` (`holderPersonId IS NOT NULL`); **capacity and skills are not derivable and are deferred (DT-04/DT-06)**."

Và §4: `IOC-03/04/05 dept / process / people twins` → **DEFERRED**.

✅ **Xác nhận: PE-07 "IOC Capacity Bridge" giải đúng blocker này.** Công thức trong handoff
`docs/05_IOC_CAPACITY_BRIDGE.md` khớp với dữ liệu thật:

| Thành phần công thức | Nguồn dữ liệu thật sau khi PE-01/PE-02 ship |
|---|---|
| Planned Capacity = active position plan × standard hours | `Position` (`holderPersonId != null`, `orgUnitId`) × `WorkCalendar`/`ShiftPattern` (PE mới) |
| − approved leave | `LeaveRequest(status=APPROVED)` (**PE-01** — đây là mảnh còn thiếu duy nhất để DT-04 chạy) |
| − absence / calendar loss | `AttendanceDay` (PE-02) + `WorkCalendar` |
| Weighted Demand | `NativeWorkItem` + `ApprovalTask` + `Ticket` + `ExecutionProject` — **đã có, IOC đã tính** |
| Utilization | `TimeEntry`/`Timesheet` approved (PE-05) |

⚠️ **Cảnh báo kỹ thuật kế thừa từ DT-00 (phải tuân thủ):** `NativeWorkItem`, `Ticket`, `Request`, `Directive`
**KHÔNG có cột `orgUnitId`**. Đường phân giải org duy nhất là
`personId → Position.holderPersonId → Position.orgUnitId`. `OrgUnitCapacityProjection` của PE-07 **bắt buộc**
join server-side theo đường này, không được `groupBy("orgUnitId")` ngây thơ.

⚠️ **OrgUnit id thật của T001** (không phải `org-*` như seed handoff giả định):
`ou-exec`, `ou-sales`, `ou-fin`, `ou-hr`, `ou-tech`, `ou-admin`, `ou-solution`, `ou-impl`, `ou-delivery`,
`ou-support`, `ou-platform`. Seed PE-01 **phải dùng bộ id này**.

---

## 4. Production blockers của handoff — trạng thái THỰC TẾ hôm nay

| Blocker (handoff `docs/00`) | Trạng thái verify 2026-08-01 | Bằng chứng |
|---|---|---|
| **Rotate ANTHROPIC_API_KEY đã lộ** | 🔴 **CHƯA LÀM.** Key trong `xhub-api/.env` vẫn có sha256-prefix `d9d24a2d90654ea4` — **trùng đúng fingerprint trong danh sách key-đã-lộ** của `src/main.ts:15`. Server sẽ in cảnh báo `[SECURITY]` mỗi lần boot. `XOFFICE_AI_LIVE=true`, `XOFFICE_AI_MODEL=claude-opus-4-8` → key **đang được gọi thật**. | Tính lại fingerprint từ `.env` bằng chính thuật toán `main.ts` → khớp. `PROJECT_STATUS_XHUB.md:81`, `HANDOFF_XHUB.md:42`, `TINH_HINH_DU_AN_XHUB.md:52` đều còn để 🔴. |
| **Nối Azure AD OIDC** | 🔴 **CHƯA.** `src/auth/oidc/` chỉ có `oidc.provider.ts` (interface/seam) + `mock-oidc.provider.ts`. `.env.example`: `AUTH_OIDC_ENABLED=false`. | `ls src/auth/oidc` |
| **Sandbox FinERP/Frappe** | 🔴 **CHƯA CÓ ADAPTER NÀO.** `FINERP` chỉ xuất hiện như **chuỗi hằng**: `src/manage/manage.constants.ts:28` (danh sách `sourceSystem` hợp lệ) và comment ở `src/xoffice/contracts/source-reference.ts:25`. Không có module/client/HTTP call nào. `FRAPPE_HR` chỉ có trong comment. | grep toàn `src/` |
| **Chốt operating mode** | 🟡 **CHƯA CHỐT** — đây chính là `PE-001` trong backlog (P0, "Owner approval"). Khuyến nghị cụ thể ở `PE_IMPLEMENTATION_PLAN.md` §2. | `backlog/IMPLEMENTATION_BACKLOG.csv` |
| **Duyệt policy attendance/payslip/privacy** | 🟡 **CHƯA** — cần chủ sở hữu duyệt, không phải việc code. | — |

➡️ **Hệ quả bắt buộc cho lộ trình PE:** hai blocker (OIDC, FinERP sandbox) **không nằm trong tầm kiểm soát của
code**. Vì vậy **PE-01 (Leave) phải được thiết kế sao cho ship được mà KHÔNG phụ thuộc cả hai** — và nó làm được,
vì Leave ở chế độ **SME Lite** chỉ đọc `PersonProfile`/`OrgUnit`/`Position` (đã có) và ghi bảng của chính nó.

---

## 5. Nav — trạng thái thực (quan trọng cho PE_UI_MOBILE_PLAN)

Comment đầu `navigation.model.ts` vẫn ghi *"Deliberately kept to 5 workspaces"* — **đã lỗi thời**.
`XHUB_NAVIGATION` thực tế có **9 mục top-level**, theo đúng thứ tự:

| # | id | label | href | gate (`permission`) |
|---|---|---|---|---|
| 1 | `home` | Trang chủ | `/home/executive` | — (mở cho tất cả) |
| 2 | `manage` | Quản trị | `/manage` | `manage.objective.read` |
| 3 | `work` | Công việc | `/inbox` | — |
| 4 | `space` | X.Space | `/space/home` | — |
| 5 | `office` | X.Office | `/office/workflows` | — |
| 6 | `business` | Doanh nghiệp | `/customers` | — |
| 7 | `platform` | Platform Console | `/platform` | `platform.tenant.read` |
| 8 | `delivery` | Solution Delivery | `/delivery` | `delivery.read` |
| 9 | `ioc` | IOC — Bản sao số | `/ioc` | `ioc.view` |

Cơ chế entitlement trong codebase này = **một `XNavItem` top-level có `permission`**; `filterNavByPermissions`
ẩn cả subtree khi `AUTH_ENFORCE=true`. Đây là cách `manage`, `platform`, `delivery`, `ioc` đều dùng.

**`/people/*` hiện KHÔNG tồn tại** — `xhub-web/src/app/people` không có. Toàn bộ là greenfield.

---

## 6. Nền tảng PE **được tái dùng, KHÔNG tạo lại**

| Hạ tầng | Có sẵn ở đâu | PE dùng thế nào |
|---|---|---|
| Tenant isolation | `PrismaService.withTenant/withBypass` + `TenantScopeInterceptor` + RLS 89 bảng | Bắt buộc, y hệt `manage`/`ioc` |
| Permission gate | `@RequirePermission('x.y.z')` + `PermissionGuard` (no-op nếu `AUTH_ENFORCE=false`) | 15 quyền `people.*` (xem `PE_API_ROUTE_PLAN.md` §3) |
| Identity trong request | `@Identity() id: RequestIdentity` (`tenantId`, `userId`) | Y hệt `manage.controllers.ts` |
| Audit | `AuditLog` | Sensitive read (payslip) bắt buộc ghi — Constitution #8 |
| Outbox / event | `OutboxEvent` (`aggregateType`, `aggregateId`, `eventType`, `payload`, `status`, `attempts`, `maxAttempts`, `nextAttemptAt`) + dispatcher retry/backoff + `/reconcile` | Toàn bộ event `xoffice.people.*` đi qua đây — **không tạo bảng event riêng** |
| Idempotency | Pattern `CommandLog` — unique `(tenantId, idempotencyKey)` → replay kết quả đã lưu (`controlplane.service.ts:309–321`) | `LeaveRequest.idempotencyKey` dùng **đúng pattern này** |
| Workflow/Approval | `WorkflowInstance` + `ApprovalTask` + `Delegation` | Duyệt nghỉ phép **có thể** đi qua ApprovalTask (xem `PE_SOR_MATRIX_DELTA.md` §4) |
| AI draft-first | `xoffice.service.ts:820–945` — client `Anthropic`, `XOFFICE_AI_LIVE` gate, mock fallback, **`mustRequireHumanApply: true`** trên mọi kết quả | PE-06 `VariablePayRecommendation` tái dùng **nguyên pattern** — AI chỉ soạn nháp (Constitution #10) |
| BFF proxy | `src/app/api/<domain>/[[...path]]/route.ts` + helper `../../admin/_forward` (`forwardGet/forwardPost/forwardPatch/readJson`) | `/api/people/*` copy y khuôn `/api/manage/*` |
| Seed + smoke | `scripts/*-seed.mjs` + `scripts/*-smoke.mjs` + `npm run seed:* / test:*` | `people-leave-seed.mjs` + `people-leave-smoke.mjs` |

---

## 7. Kết luận PE-00

1. Baseline handoff **đủ tin cậy để dùng** — không cần viết lại như MG-00 đã phải làm.
2. Hai con số cần khoá lại: **RLS = 89** (moving target), **Prisma models = 104**.
3. **PE-06** có bề mặt tích hợp Management OS **đầy đủ hơn** handoff ngụ ý (MG-03 xong hẳn).
4. **PE-07** giải đúng blocker khiến **DT-04** bị hoãn — xác nhận thứ tự PE-01 → … → PE-07 là hợp lý.
5. Ba blocker hạ tầng (**key chưa rotate**, **OIDC mock**, **không có adapter FinERP/Frappe**) → chỉ có
   **SME Lite** là mode ship được ngay. Xem `PE_IMPLEMENTATION_PLAN.md`.
6. **PE-01 Leave & Availability** là lát dọc đầu tiên buildable — không phụ thuộc external nào.
