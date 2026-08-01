# XOFFICE_WORK — Integration Plan

> Docs-only. Cách Work liên kết với các module/hệ thống khác, không dual-write.
> Nguồn: handoff `docs/08_INTEGRATION_ARCHITECTURE.md`, `docs/09_EVENT_CATALOG.md`, `data/INTEGRATION_MATRIX.csv`, `contracts/external-work-link.schema.json`.
> Grounding: `xhub-api/src/webhook/{webhook.dispatcher.ts,webhook.service.ts,hmac.util.ts}` (webhook đã có), control-plane pattern (`scripts/controlplane-*`), BFF proxy web (`src/app/api/*/route.ts`).
> Chị em: `XOFFICE_WORK_UI_PLAN`, `XOFFICE_WORK_SCHEMA_PLAN`, `XOFFICE_WORK_ROUTE_MIGRATION_PLAN`, `XOFFICE_WORK_TEST_PLAN`.

---

## 1. Bốn pattern tích hợp (từ `docs/08`) — KHÔNG dual-write

1. **Projection** — event nguồn → UnifiedWorkItem/read model. Không copy state nguồn thành domain có thể ghi.
2. **Linked native follow-up** — user/automation chủ động tạo NativeWorkItem + `ExternalWorkLink`. Chỉ tạo follow-up khi thực sự cần **trách nhiệm / deadline / tiến độ / bằng chứng**.
3. **Delegated command** — XHub gửi lệnh tới nguồn kèm permission/version/idempotency; NGUỒN quyết định hợp lệ.
4. **Deep link / context card** — surface link tới bản gốc quyền uy.

Nguyên tắc: **link/projection trước, follow-up sau** — không nhân bản vòng đời của nguồn.

---

## 2. Contract liên kết

- **`ExternalWorkLink`** (schema đã có): `sourceSystem, sourceType, sourceId, sourceVersion?, deepLink?, relation ∈ {CONTEXT, ACTION_ITEM, FOLLOW_UP, BLOCKED_BY_SOURCE, EVIDENCE_FOR, RELATED_TO, CREATED_FROM}, lastSyncedAt?, syncStatus ∈ {OK,PENDING,FAILED,STALE}, metadata`.
- **`WorkLink`** (nội bộ XHub, đề xuất ở `XOFFICE_WORK_SCHEMA_PLAN`): liên kết NativeWorkItem ↔ Directive/Ticket/Booking/Request/Document/CanonicalProject/Customer trong cùng tenant (không cần sourceSystem).

---

## 3. Ma trận tích hợp (từ INTEGRATION_MATRIX.csv) + tình trạng khả thi

| Hệ thống | Object (SoR) | Pattern | Hành vi Work | Live được NGAY? |
|---|---|---|---|---|
| XOffice Workflow | Request / WorkflowTask | LINK + PROJECTION | Link runtime task/context; native follow-up chỉ khi explicit | ✅ (module `requests`, `/tasks/[id]` có sẵn) |
| XOffice Directive | Directive | LINK (`relation=ACTION_ITEM`) | Action item của chỉ đạo → NativeWorkItem link | ✅ (`office/directives`, module `directives`) |
| XOffice ServiceDesk | Ticket | LINK / OPTIONAL_FOLLOWUP | Chỉ tạo work cross-team khi cần, tránh vòng status kép | ✅ (`office/service-desk`, module `tickets`) |
| XOffice Booking | Booking | CALENDAR_PROJECTION / FOLLOWUP | Hiện lịch; tạo setup/follow-up | ✅ (module `bookings`; calendar projection §5 UI) |
| Mattermost / X.Space | Message/Channel/Thread | INTERACTION + LINK | Tạo work sau confirm; render linked work | ⚠️ cần **Mattermost mock/sandbox** (X.Space UI có, MM backend chưa) |
| FinERP | ERP Transaction | PROJECTION / DELEGATED_COMMAND / LINK | Follow-up + lệnh tới nguồn | ⚠️ cần **external FinERP sandbox** |
| XBooking | Booking/Sales Txn | PROJECTION / LINK / FOLLOWUP | Follow-up vận hành | ⚠️ external, chưa live |
| XBuilding | Building Operation | PROJECTION / LINK / FOLLOWUP | Follow-up vận hành | ⚠️ external, chưa live |
| Shared MDM | CanonicalProject | REFERENCE | ExecutionProject.canonicalProjectId → canonical | ✅ (`/projects` MDM có sẵn) |
| Tenant Launch Factory | LaunchRun/Step | REFERENCE + EVENT | Milestone triển khai link launch evidence | ✅ (module `platform`/launch-factory có) |
| X.AI | Analysis/Draft | ADVISORY | Suggest/summarize/draft; human/policy confirm write | ✅ advisory (AiRecap), write cần confirm |

**Live NGAY (nội bộ XHub):** Workflow, Directive, ServiceDesk, Booking, MDM, Launch Factory, X.AI advisory — đều có module xhub-api + route web.
**Cần external sandbox/mock:** FinERP (delegated command), Mattermost (create-work flow), XBooking, XBuilding → dùng **mock adapter** để pass Gate E (ít nhất 1 Mattermost create-work + 1 projection + 1 native follow-up + delegated command idempotency).

---

## 4. Chi tiết per-integration (giữ SoR)

- **X.Space/Mattermost:** message/thread/channel = MM SoR. "Create task" → NativeWorkItem **sau khi user confirm** + `ExternalWorkLink(sourceSystem=mattermost, relation=CREATED_FROM, deepLink)`. Channel/project page render Work projection theo link/filter. KHÔNG tạo "task master" ẩn trong MM.
- **Directive:** Directive vẫn là SoR chỉ đạo. Action item = NativeWorkItem `WorkLink(relation=ACTION_ITEM)` tới Directive. KHÔNG nhân đôi lifecycle chỉ đạo.
- **Service Desk:** Ticket = SoR. Case đơn giản giữ trong ticket state; chỉ tạo NativeWorkItem khi execution cross-team đáng kể. Tránh vòng đồng bộ status kép.
- **Booking:** Booking = SoR reservation. Calendar tổng hợp booking; setup/follow-up → work.
- **FinERP:** ERP record = FinERP SoR. Work link tới PO/invoice/payment/project ref; mọi chuyển trạng thái ERP = **delegated command** (kèm version + idempotency key) → FinERP validate.
- **XBooking/XBuilding:** transaction source-owned. Follow-up vận hành thành Work; hoàn tất phát result event/ref ngược về; không ghi đè state nguồn trừ khi API nhận delegated command.
- **X.AI:** summarize/classify/detect slippage/draft status report/đề xuất thay đổi work-deadline-owner. Write tác động cao cần human confirm + policy.
- **Solution Delivery / Tenant Launch:** hoạt động triển khai dùng chung ExecutionProject; Launch Factory = SoR launch state; **link** launch step/milestone, không copy launch lifecycle vào task status. Route `/delivery/*` (workspace Solution Delivery) deep-link cùng ExecutionProject id — không copy state (handoff `docs/04` §Solution Delivery).

---

## 5. Event catalog (version mọi payload — `docs/09`)

Domain events phát qua **outbox → webhook dispatcher đã có** (`webhook.dispatcher.ts`, HMAC ký `hmac.util.ts`):

```
xoffice.work.item.created / .assigned / .status_changed / .due_changed / .completed
xoffice.project.created / .health_changed / .progress_recalculated
xoffice.project.baseline_created / .rebaselined / .milestone_slipped / .report.published
xoffice.work.external_link.created
```
(Đồng bộ tên với UI/skill: `work.created`, `work.assigned`, `work.progress.updated` → map sang `xoffice.work.item.*`; `baseline.set` → `xoffice.project.baseline_created`.)

Envelope bắt buộc: `eventId, tenantId, occurredAt, correlationId, causationId, actor?, entityType/id/version`. **Consumer idempotent**; projection event có thể **replay** để rebuild UnifiedWorkItem.

---

## 6. Cơ chế tái dùng (không xây mới)

- **Outbox + webhook dispatcher** (`src/webhook`): thêm event type Work vào dispatcher hiện có; giữ HMAC + retry.
- **Control-plane pattern** (`scripts/controlplane-*`): projection/reconciliation Work theo cùng khuôn reset+smoke.
- **BFF proxy** (`_forward.ts`): mọi lệnh delegated-command đi từ web → xhub-api → nguồn; FE không gọi thẳng nguồn.
- **Idempotency:** delegated command mang `idempotencyKey` (mirror pattern webhook); consumer dedupe theo `eventId`.
