# XOFFICE_IMPLEMENTATION_PLAN.md

Nguồn: handoff `XTECH_XHUB_XOFFICE_WORKFLOW_AI_HANDOFF_20260729`.
Phạm vi đợt này (đã chốt với owner): **Vertical slice POC (golden path)** · persistence **in‑memory/seed + Prisma schema draft** · AI **mock tool gateway**.

## P0 — Audit hiện trạng (đã có)

- **Frontend** `D:\Code\xhub-web`: Next.js 16 App Router + Tailwind v4 (design system Tailux đã port) + nav‑mode system (rail‑context/expanded, server‑authoritative). Route IA: `/home/* /inbox /work /approvals /projects/[id] /apps /space/*`. Data layer `src/xhub/lib` (seed tĩnh + tenant isolation).
- **Backend** `D:\Code\xhub-api`: NestJS, port 4000. Hiện phục vụ **seed tĩnh** (`/api/tenants/:tenantId/collections/*`) + preference (`/api/me/ui-preferences`). **Chưa có DB.**
- **Chưa có**: React Flow, DB/Prisma, AI client. Đây là các bổ sung mới.

## Quyết định (ADR tóm tắt)

- **ADR‑X01 Canvas = @xyflow/react (React Flow)** MIT. bpmn‑js chỉ adapter/viewer sau. DSL nội bộ (`WorkflowDefinitionDocument`) là canonical; canvas x/y chỉ là presentation.
- **ADR‑X02 Persistence**: POC dùng store in‑memory nạp từ `seeds/xoffice/*.json`; **Prisma schema draft** (không migrate DB thật đợt này). Đấu SQLite→Postgres ở phase sau.
- **ADR‑X03 AI Copilot**: **mock tool gateway** trả `WorkflowPatchSet` hợp lệ (validate theo `contracts/workflow-patch-set.schema.json`), **draft‑first + preview/diff + human confirm**, KHÔNG ghi production. Đấu Claude (server) sau.
- **ADR‑X04 Form**: schema‑first (JSON Schema + RJSF + custom Tailux widget); không mua Survey Creator ở MVP.
- **System of record**: X.Office **sở hữu** office workflow/approval/eForm/ticket/booking. FinERP/XBooking/XBuilding qua **Approval Aggregation Adapter** (không tạo approval engine chung). UnifiedWorkItem mở rộng: `sourceSystem, sourceRecordId, sourceVersion, sourceTaskId, ownerSystem, deepLink, allowedActionsSnapshot`.

## Package placement

- Frontend builder: `xhub-web/src/xoffice/` (canvas/, nodes/, edges/, palette/, inspector/, outline/, validation/, simulation/, ai-copilot/, version-diff/, stores/, adapters/, testing/). Store editor = Zustand (normalized nodes/edges/selection/history).
- Routes (dưới segment **X.Office**): `/office/workflows` (WF‑01), `/office/workflows/[id]/builder` (WF‑02/03/04/05/07), `/office/monitor` (WF‑10). Thêm segment rail "X.Office".
- Backend module: `xhub-api/src/xoffice/` (definition, version, validate, simulate, publish, runtime instance/task/event, audit, ai‑mock). Nạp `seed-data/xoffice/*.json`.

## Contracts & seed (đã có trong handoff → copy vào repo)

- Contracts: `workflow-definition`, `form-definition`, `condition-ast`, `workflow-patch-set` (JSON Schema).
- Seeds: `node-catalog`, `workflow-definitions` (mua sắm, booking phòng, ticket CNTT), `form-definitions`, `ai-assistance-scenarios`, `role-bindings`, `workflow-instances`.

## Vertical slice — golden path (đợt này)

`AI mock tạo workflow → sửa canvas → validate → mô phỏng → publish version → tạo request → phát sinh approval task → xử lý → audit`.

Trình tự thực thi:

1. **Deps + seed + Prisma draft**: cài `@xyflow/react elkjs @dnd-kit/core zod zustand`; copy `seeds/xoffice/*` + `contracts/*` vào 2 repo; viết `prisma/schema.prisma` draft (workflow, workflowVersion, node, edge, instance, task, event, auditLog) — chỉ draft.
2. **Backend xoffice module (in‑memory)**: endpoints list/get definition+version, validate (semantic), simulate, publish (version immutable), create request→instance, list/act approval task, audit log; ai‑mock `POST /api/xoffice/ai/draft` trả WorkflowPatchSet từ seed. Tenant‑scoped + guard.
3. **WF‑01 Danh mục quy trình**: list từ seed (version/owner/usage), mở builder.
4. **WF‑02 Builder shell**: React Flow canvas + node palette (dnd‑kit, node‑catalog) + inspector (rhf+zod) + undo/redo + save/restore + ELK auto‑layout. Custom node Tailux cho start/approval/condition/serviceCall/end.
5. **WF‑03 AI tạo quy trình**: prompt tiếng Việt → gọi ai‑mock → hiện assumptions + **patch preview/diff** → apply vào canvas (human confirm).
6. **WF‑07 Validate & Simulation**: issue panel (lỗi/bottleneck) + mô phỏng path với test data.
7. **Publish**: tạo version immutable; **WF‑10 Runtime monitor**: tạo request → instance/token → approval task → xử lý (duyệt/từ chối) → timeline + audit.
8. **Test**: tenant isolation + version immutability; typecheck + build xanh.

## Không được làm (handoff)

Không xoá/thay workflow ERP/Frappe hiện có; không tạo approval engine chung cho mọi source; AI không tự ghi production; version đã publish là immutable; mọi query mang tenant.

## Definition of done (đợt slice)

3 workflow seed chạy được golden path; AI mock trả patch hợp lệ có preview/diff; test tenant isolation + version immutability pass; tsc 0 lỗi; build xanh.
