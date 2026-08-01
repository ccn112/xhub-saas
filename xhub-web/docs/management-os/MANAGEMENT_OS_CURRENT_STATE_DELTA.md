# MANAGEMENT OS — CURRENT STATE DELTA (Rebase Audit MG-00)

> Đối chiếu **giả định của handoff** `XHUB_XOFFICE_MANAGEMENT_OPERATING_SYSTEM_HANDOFF_20260801`
> với **thực tế mã nguồn** tại `D:\Code\xhub-saas\xhub-api` (backend NestJS + Prisma) và
> `D:\Code\xhub-saas\xhub-web` (frontend Next.js).
> Nguyên tắc nguồn sự thật (theo `START-HERE.md`): **Code/schema/test thực tế > Project Context > Decision Log >
> Current Status > Constitution > handoff này > handoff lịch sử.** Mọi khẳng định dưới đây đã verify bằng đọc file.
> Ngày rebase: 2026-08-01. Bộ tài liệu anh em: `MANAGEMENT_DOMAIN_COLLISION_MAP.md`,
> `MANAGEMENT_SOR_MATRIX_DELTA.md`, `MANAGEMENT_ROADMAP_REBASE.md`, `MANAGEMENT_UI_ROUTE_PLAN.md`.
> Docs-first: **KHÔNG code, KHÔNG chạm các file build W3 đang chạy** (`xhub-web/docs/work-pm/*`).

## 0. TL;DR — handoff giả định LỖI THỜI, thực tế đi xa hơn

Handoff `docs/00_CURRENT_STATE_REBASE.md` mô tả trạng thái **"đang ở PH-02b"** (Directive/Commitment đang làm)
và ngụ ý phải "finish current XOffice operational (PH-02b→f)" trước. **Điều này đã sai so với code.** Thực tế:

- **PH-02 ĐÓNG HOÀN TOÀN (6/6 nghiệp vụ)** — Request · Directive · Ticket · Booking · Announcement ·
  Records-attachment (`DEV_BACKLOG.md` v0.10.0 "ĐÓNG"). ➡️ **BỎ QUA toàn bộ "PH-02b→f".**
- **SaaS v1.0 hoàn tất, 10 tenant (T001–T010) live** — Tenant Registry (`Tenant.tenantNo/tenantCode/…`),
  Platform Console (`platform.*` / `PLT_` namespace), Launch Factory (`TenantLaunch`), Blueprint/SeedPack.
  Handoff MOS **không biết** lớp multi-tenant + platform plane này tồn tại.
- **Work v2: W1 + W2 ĐÃ XONG, W3 ĐANG CHẠY.** Các model PM đã **tồn tại thật** trong `schema.prisma`:
  `NativeWorkItem`, `ExecutionProject`, `WorkDependency`, `ProjectBaseline`/`BaselineItem`,
  `ProjectRoleAssignment`, `CoordinationShare`, `WorkDimension` — verify tại dòng 1627–1891.
  ➡️ **Hệ quả then chốt cho MG:** MG-04 Portfolio **LINK** vào `ExecutionProject` đã có (KHÔNG rebuild engine PM);
  "Action/Commitment" của MG **LINK** vào `NativeWorkItem` đã có.
- **81 model** tổng trong `prisma/schema.prisma`; **53 bảng RLS** đăng ký trong `scripts/rls-setup.mjs`.
- **KHÔNG có** bất kỳ model nào cho Strategy/KPI/OKR/Meeting/Decision/Scorecard/Initiative/Dashboard/Risk
  (verify: grep `^model (Strategic|Metric|Scorecard|Okr|Meeting|Decision|Initiative|Dashboard|Risk|…)` → NONE).
  ➡️ Toàn bộ tầng "Align/Decide/Review/Learn" của MOS là **greenfield** (thêm mới, không đụng bảng cũ).
- **AI đã wire thật**: `@anthropic-ai/sdk` dùng trong `xhub-api/src/xoffice/xoffice.service.ts`
  (client `Anthropic`, model mặc định `claude-opus-4-8`, `messages.create`), pattern **draft-first + human confirm**
  (`mustRequireHumanApply:true`, có mock fallback khi `XOFFICE_AI_LIVE≠true`). Đây là nền để mở AI Copilot MG-07.

### ⚠️ Xung đột handoff-vs-code đã phát hiện (code thắng)
| Claim | Nguồn claim | Thực tế trong code | Xử lý |
|---|---|---|---|
| "current phase PH-02b" | handoff `docs/00` | PH-02 đóng 6/6 (`DEV_BACKLOG` v0.10.0) | Bỏ qua PH-02b→f |
| "~67 RLS tables" | ước lượng điều phối | **53** trong `scripts/rls-setup.mjs`; SaaS-era peak 53–55 (`DEV_BACKLOG`) | Dùng 53; MG cộng thêm vào 53 |
| ExecutionProject/NativeWorkItem "sẽ xây ở MG" | handoff domain model | **ĐÃ tồn tại** (Work W1/W2) | MG **link**, không tạo lại |

## 1. Bảng năng lực MOS: Sense / Align / Decide / Execute / Review / Learn

Vòng lặp quản trị của handoff (`docs/01_MANAGEMENT_OS_VISION.md`). Đối chiếu từng năng lực với code hiện có.

| Năng lực MOS | Ý nghĩa | Đã có gì trong CODE (thực tế) | Còn thiếu (greenfield MG) |
|---|---|---|---|
| **Sense** (cảm nhận) | Thu tín hiệu: metric, KPI observation, cảnh báo | ❌ Chưa có `MetricDefinition`/`MetricObservation`/`ManagementAlert`. Có nguồn dữ liệu thô: workflow events, `AuditLog`, `OutboxEvent`, dashboards seed `/home/executive`,`/home/sales`,`/reports` | MG-01: `MetricDefinition` (Mgmt SoR) + `MetricObservation` (**read model**, không dual-write) + connector đọc từ SoR nghiệp vụ |
| **Align** (căn chỉnh) | Chiến lược→mục tiêu→BSC→OKR | ❌ Chưa có `StrategicTheme`/`StrategicObjective`/`Scorecard`/`OKRCycle`/`Objective`/`KeyResult` | MG-01 (Objective), MG-03 (Scorecard/OKR) — greenfield |
| **Decide** (quyết định) | RAPID, decision record, họp điều hành | ❌ Chưa có `DecisionRecord`/`MeetingSeries`/`MeetingInstance`/`ManagementCadence`. Có `Directive` (chỉ đạo) — **gần** nhưng KHÁC (xem Collision Map) | MG-02: Meeting/Decision/Review greenfield; Decision **link** action→`NativeWorkItem` |
| **Execute** (thực thi) | Initiative/Project → Action/Commitment → tiến độ | ✅ **≈ MODULE WORK ĐÃ XÂY.** `ExecutionProject` (WBS roll-up, baseline, health), `NativeWorkItem` (task/milestone/deliverable/**FOLLOW_UP**, `sourceContext`, `dimensions`), `WorkDependency`, `Directive`/`DirectiveAssignment` (cam kết chỉ đạo) | Chỉ cần **LINK**: `Initiative.executionProjectId` → `ExecutionProject`; `ActionCommitment` → `NativeWorkItem`. Không xây engine thứ 2 |
| **Review** (rà soát) | Business review nhịp ngày/tuần/tháng/quý | ❌ Chưa có `BusinessReview`. Nhịp họp chỉ là tài liệu, chưa executable | MG-02: `BusinessReview` + `ManagementCadence` greenfield |
| **Learn** (học) | PIR, benefit realization, cải tiến | ❌ Chưa có `BenefitProfile`/PIR/`ProcessDefinition` (cải tiến). Có `WorkItemEvent`/`ExecutionProjectEvent` (timeline nền) | MG-04 (Benefit), MG-06 (Process), MG-08 (learning loop) greenfield |

**Kết luận:** Trong 6 năng lực, **duy nhất "Execute / Work & Commitments" đã hiện hữu** (Work v2). Năm năng lực còn lại
(Sense/Align/Decide/Review/Learn) là greenfield — thêm mới bên cạnh, tôn trọng phân tách thực thể (Constitution #13).

## 2. Nền tảng KHÔNG được tạo lại (`START-HERE.md` §"Không tạo lại")
Identity · RLS Postgres · Workflow Core (`Workflow*`, `ApprovalTask`) · Shared MDM (`MasterRecord`) · Records ·
Backup · Control Plane. **Đã hoàn thành — MG tái dùng, không đụng.**

## 3. Cross-reference: quan hệ với Work v2 (bộ `docs/work-pm/*`)
MG **kế thừa trực tiếp** kết quả của Work v2. Đọc kèm để không mâu thuẫn:
- `XOFFICE_WORK_CURRENT_STATE_DELTA.md` — xác nhận PH-02 đóng, 3-tier task, 2 khái niệm project.
- `XOFFICE_WORK_ENTITY_COLLISION_PLAN.md` — quy tắc `WorkLink{kind,refId}` (Directive/Ticket/Request→WorkItem)
  mà MG sẽ tái dùng cho `ActionCommitment→NativeWorkItem`.
- `XOFFICE_WORK_SCHEMA_PLAN.md`, `XOFFICE_WORK_ROUTE_MIGRATION_PLAN.md`, `XOFFICE_WORK_UI_PLAN.md` — quy tắc route `/work/*`
  và Portfolio hiện tại; MG **không** trùng `/work/portfolio` (xem UI Route Plan).

> ⚠️ Không sửa các file dưới `docs/work-pm/*` — W3 đang chạy.
