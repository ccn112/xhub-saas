# XOFFICE_WORK — Test Plan (Smoke / UAT, W1–W8)

> Docs-only. Bộ kiểm thử theo acceptance gates cho X.Office Work & PM v2.
> Nguồn: handoff `docs/12_ACCEPTANCE_GATES.md`, `data/PHASE_CATALOG.csv`.
> Grounding convention (xhub-api): `package.json` scripts `test:*` = `node scripts/<x>-reset.mjs && node scripts/<x>-smoke.mjs`; smoke **self-cleaning** dưới RLS bypass (Postgres trực tiếp), assert theo `x-tenant-id`/`x-user-id` header, prefix `*-SMOKE-*`. Mẫu: `directives-smoke.mjs`, `isolation-test.mjs`, `rls-test.mjs`, `webhook-smoke.mjs`.
> Chị em: `XOFFICE_WORK_UI_PLAN`, `XOFFICE_WORK_INTEGRATION_PLAN`, `XOFFICE_WORK_SCHEMA_PLAN`, `XOFFICE_WORK_ENTITY_COLLISION_PLAN`.

---

## 0. Quy ước (mirror repo)

- Mỗi bộ = script `.mjs` re-runnable, server `:4000` phải up (`XOFFICE_BASE`).
- **Self-cleaning:** cuối smoke xoá mọi bản ghi prefix `WORK-SMOKE-` / `EPROJ-SMOKE-` qua Postgres (RLS bypass) — như directives-smoke.
- Assert helper `ok(cond,msg)`, exit code ≠0 khi `failed>0`.
- Isolation: tenant `demo-isolation` phải thấy 0 hàng của `tenant-xtech`; marker `MUST_NOT_LEAK` không rò (theo `isolation-test.mjs`).
- Cập nhật `docs/TEST_LOG.md` (web) khi user tick `/docs/test` theo nav & test-log workflow.

---

## 1. Ánh xạ Gate → Phase → Script

| Gate (docs/12) | Phase | Script `test:work-*` đề xuất |
|---|---|---|
| B (Domain) | W1 | `test:work-item` |
| B (Domain) | W2 | `test:work-project` |
| C (UI/Schedule) | W3 | `test:work-schedule` (Gantt server validation) |
| D (Governance) | W1–W4 | `test:work-rls`, `test:work-coordination` |
| C/W4 | W4 | `test:work-report`, `test:work-stats` |
| E (Integration) | W6 | `test:work-integration` |
| D (delegated cmd) | W6 | `test:work-delegated` |
| F (Solution Delivery) | W5 | `test:work-delivery` |
| A (Rebase safety) | W-R0 | (doc gate — không code; check collision plan approved) |

---

## 2. Bộ smoke/UAT chi tiết

### `test:work-item` (W1 — NativeWorkItem core, Gate B/D)
- CRUD NativeWorkItem (TASK/SUBTASK/MILESTONE…); parentId/wbsCode hợp lệ.
- RLS: tenant khác không đọc/ghi được (assert 403/0 rows); `demo-isolation` thấy 0.
- Isolation `MUST_NOT_LEAK` không rò.
- Assignee/owner snapshot; status transition hợp lệ; illegal transition → 400.
- Event `xoffice.work.item.created/assigned/status_changed` phát ra outbox (assert có event, version).

### `test:work-project` (W2 — ExecutionProject/WBS/dependency/baseline/progress, Gate B)
- Tạo ExecutionProject (projectKind/status/health/progressMethod); RLS.
- WBS: gắn work vào project, cây parent/child, wbsCode.
- **Dependency cycle guard:** tạo FS/SS/FF/SF hợp lệ; tạo cạnh gây chu trình → **400** (assert).
- **Baseline immutable:** set baseline (currentBaselineVersion=1) → sửa baseline cũ bị từ chối; rebaseline tạo version 2.
- **Progress methods:** MANUAL / TASK_WEIGHTED / MILESTONE_WEIGHTED / DELIVERABLE_WEIGHTED tính đúng progressPercent; event `progress_recalculated` / `baseline_created`.

### `test:work-schedule` (W3 — Gantt server validation, Gate C)
- Drag/resize = Schedule Command: server validate constraint (predecessor FS ràng buộc start) → hợp lệ 200, vi phạm → 400 (client rollback).
- Cycle prevention lặp lại ở tầng command.
- Milestone slip → event `xoffice.project.milestone_slipped`.

### `test:work-coordination` (W3 — CHỦ CHỐT owner #1, Gate D)
Coordination/summary visibility:
- User chỉ có `work.view.summary` GET item cross-team → **chỉ nhận `SummaryWorkItemDTO`**: assert **có** `title, progressPercent, plannedStart, plannedFinish, milestone`; assert **KHÔNG có** `description, attachments, children` (field omitted).
- Fetch children của summary item → **403** (không bung được child).
- Fetch attachment/description endpoint của summary item → **403/omitted**.
- User đủ quyền (project member) → full DTO (có children/description/attachments).
- Pivot/stats chỉ cộng field summary cho hàng summary (không lộ chi tiết).

### `test:work-stats` (W4 — CHỦ CHỐT owner #2, tags/dimension)
- Tạo work với `tags[]` + dimension (Loại việc/Giai đoạn/Nhóm chi phí/Bộ phận).
- Filter theo tag (AND/OR) trả đúng tập; filter theo mỗi dimension đúng.
- **Cross-tab đúng:** pivot Bộ phận × Giai đoạn → count/sum khớp dữ liệu seed (assert từng ô).
- Group-by tag/dimension số liệu khớp; hàng ngoài quyền không được tính.

### `test:work-rls` (W1–W4 — Gate D)
- RBAC/DataScope/project-role isolation; không tin `tenantId` từ client (header giả → reject).
- Bảng tenant mới có RLS; SYSTEM-* `MUST_NOT_LEAK` pass; audit ghi cho thay đổi high-impact (baseline, reassign, publish report).

### `test:work-report` (W4 — Status Report, Gate C/W4)
- Report versioned: draft → review → publish; published **immutable** (sửa → 400), version tăng.
- Event `xoffice.project.report.published`.
- AI draft (advisory) không auto-publish (cần human confirm).

### `test:work-integration` (W6 — Gate E, no dual-write)
- 1 projection flow (external event → UnifiedWorkItem read model; replay rebuild đúng, idempotent theo eventId).
- 1 native follow-up (`ExternalWorkLink relation=FOLLOW_UP/CREATED_FROM`).
- ≥1 Mattermost create-work flow (mock adapter) — tạo work sau confirm, không tạo MM task master ẩn.
- Directive action-item link không sinh state Directive trùng.
- Retry/idempotency/reconciliation: gửi trùng event → 1 lần hiệu lực.

### `test:work-delegated` (W6 — delegated command idempotency/audit, Gate D/E)
- Delegated command → FinERP mock kèm `idempotencyKey` + version: gửi 2 lần → 1 hiệu lực; version mismatch → nguồn reject; mọi lệnh ghi audit.

### `test:work-delivery` (W5 — Gate F)
- Implementation project template tạo WBS/milestones/work; link customer + blueprint + UAT + go-live + launch reference.
- Cùng ExecutionProject id dùng được từ Work workspace và `/delivery/*` **không copy state** (assert cùng id, sửa 1 nơi thấy nơi kia).

### W7 (X.AI) / W8 (Hardening)
- W7: AI eval + human-confirmation gate (không script cứng — checklist UAT).
- W8: scale (100k item pagination/virtualization), security scan (`scan:secrets`), backup, a11y (keyboard Gantt fallback), observability (projector lag) — chạy lại toàn bộ `test:work-*` + `test:rls` + `test:isolation`.

---

## 3. Scripts cần thêm (xhub-api `package.json`)

```
"test:work-item":         "node scripts/work-item-reset.mjs && node scripts/work-item-smoke.mjs",
"test:work-project":      "node scripts/work-project-reset.mjs && node scripts/work-project-smoke.mjs",
"test:work-schedule":     "node scripts/work-schedule-smoke.mjs",
"test:work-coordination": "node scripts/work-coordination-smoke.mjs",
"test:work-stats":        "node scripts/work-stats-smoke.mjs",
"test:work-rls":          "node scripts/work-rls-test.mjs",
"test:work-report":       "node scripts/work-report-smoke.mjs",
"test:work-integration":  "node scripts/work-integration-smoke.mjs",
"test:work-delegated":    "node scripts/work-delegated-smoke.mjs",
"test:work-delivery":     "node scripts/work-delivery-smoke.mjs",
"seed:work":              "node scripts/work-seed.mjs"
```
Tất cả tuân convention self-cleaning + prefix `WORK-SMOKE-`/`EPROJ-SMOKE-`, RLS bypass Postgres cuối script (mẫu `directives-smoke.mjs`). Có thể gộp `test:work` = chạy tuần tự toàn bộ.
