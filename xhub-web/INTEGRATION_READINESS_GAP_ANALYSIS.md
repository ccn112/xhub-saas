# INTEGRATION READINESS — GAP ANALYSIS

> Docs-first BẮT BUỘC (handoff `XTECH_XHUB_XOFFICE_STANDALONE_SAAS_HANDOFF_20260729`).
> Đối chiếu READ-ONLY, KHÔNG sửa code. Ngày 2026-07-29.
> Mục tiêu: XOffice chạy standalone NHƯNG sẵn sàng nối FinERP / Frappe HR / e-sign / email / IdP / Mattermost qua connector/API/webhook/mapping — KHÔNG tạo chứng từ ERP giả.

## 0. Nguồn
- `handoff\...\docs\07_INTEGRATION_READINESS.md`, `02` (trạng thái connector), `06` (External Action node)
- `handoff\...\contracts\external-action.schema.json`, `source-reference.schema.json`, `webhook-envelope.schema.json`
- `handoff\...\config\connector-catalog.example.yaml`, `api\openapi-outline.yaml`
- Code: `D:\Code\xhub-api\src\xoffice\xoffice.service.ts`, `contracts\source-reference.ts`, `contracts\connector-mapping.schema.json`, `prisma\schema.prisma`

## 1. Trạng thái connector (docs 02/07) vs hiện trạng

Chế độ chuẩn: `UNCONFIGURED / MANUAL / MOCK / LIVE / DISABLED`.

| Thành phần integration (docs 07) | Trạng thái | Evidence |
|---|---|---|
| ConnectorDefinition (catalog) | ✅ | `xoffice.service.ts:47,77,266` load `connector-catalog.json`; `findAction :281` |
| ConnectorInstance theo tenant | ❌ | Không có model/loại per-tenant instance; catalog là global tĩnh |
| MappingDefinition versioned | 🟡 | Mapping resolver data-driven `resolveConnectorPayload :308-344`; schema `connector-mapping.schema.json` có; **chưa versioned/persist per tenant** |
| CommandEnvelope | 🟡 | `contracts/source-reference.ts` type + dùng corr/idempotency ở create/act; chưa bao mọi lệnh connector |
| SourceReference | ✅ (nội bộ) | `ConnectorCommand.sourceRef` `schema.prisma:146`; `buildSourceRef :391-403`; `UnifiedWorkItem.source*` |
| ConnectorCommand | 🟡 | `schema.prisma:135-154` persist (status/attempts/result/error); **chạy đồng bộ trong HTTP**, không outbox |
| OutboxEvent / InboxEvent | ❌ | Không có |
| WebhookEndpoint / WebhookDelivery | ❌ | Không có |
| ReconciliationJob | ❌ | Không có |
| ExternalExecution (mode + status) | ❌ | Không có; xem §2 |

## 2. ExternalExecution modes (điểm nghẽn nghiêm trọng)

`external-action.schema.json` yêu cầu `connectorKey, operation, executionMode(NONE/MANUAL_TASK/REST_API/OUTBOUND_WEBHOOK/EVENT/DEEP_LINK/DISABLED), status(NOT_REQUIRED/WAITING_MANUAL_EXECUTION/WAITING_CONNECTOR/PROCESSING/COMPLETED/FAILED/CANCELLED)` + `fallbackAssigneeRole, completionEvidenceRequired, sourceReference, manualEvidence[]`.

**Hiện trạng vi phạm**: `serviceCall` → `executeServiceCalls` (`xoffice.service.ts:1237-1310`) gọi `mockConnectorResult` **bịa chứng từ** `materialRequestId:"MR-xxx", system:"FinERP"` (`:363-369`) và `reservationId` (`:372-377`). Điều này:
- vi phạm CLAUDE.md handoff quy tắc 4 & 5 ("không tạo chứng từ giả"; "external chưa sẵn dùng MANUAL_TASK/WAITING_FOR_CONNECTOR");
- vi phạm docs 07 ("Khi connector chưa cấu hình: ExternalExecution = WAITING_MANUAL_EXECUTION/WAITING_CONNECTOR; OutboxEvent = WAITING_FOR_CONNECTOR").

**Cần**: node External Action thay `serviceCall` bịa số, mặc định `MANUAL_TASK` → sinh task cho `fallbackAssigneeRole` nhập mã tham chiếu thật; `SourceReference` xây từ mã nhập tay; connector `MOCK/LIVE` chỉ chạy qua outbox worker NGOÀI transaction (docs 07: "Không gọi connector LIVE trong transaction HTTP").

## 3. Webhook inbound (docs 07) vs hiện trạng
`POST /api/integrations/webhooks/:connectorKey/:tenantKey` — yêu cầu: event ID dedup, timestamp/replay protection, signature hook, tenant resolution, payload redaction, mapping, DLQ, audit.
- Hiện trạng: ❌ không có endpoint webhook nào (`openapi-outline.yaml` mới là outline chưa hiện thực). Cần model `InboxEvent`/`WebhookDelivery` + idempotency theo event id.

## 4. Webhook outbound / Outbox (docs 07)
- Envelope CloudEvents (`webhook-envelope.schema.json`): `specversion:"1.0", id, source, type, time, tenantId, correlationId, data` (bắt buộc) + `subject, actorId, causationId, idempotencyKey`.
- Outbox pattern: transaction workflow chỉ ghi business state + audit + outbox; worker xử lý connector ngoài transaction HTTP; khi chưa cấu hình → `WAITING_FOR_CONNECTOR`, không retry vô hạn, admin có thể chuyển manual/replay.
- Hiện trạng: ❌ không có outbox; connector command tạo & "chạy" đồng bộ ngay trong `createRequest/actOnTask` → sai pattern.

## 5. Idempotency & reconciliation
- `CommandLog` (`schema.prisma:281-294`) idempotent cho create/act; **chưa** cho connector command / webhook inbound / outbox (backlog `XO-S1-002`, `XO-S5-002`).
- `SourceReference.syncStatus` (schema handoff: LOCAL_ONLY/PENDING/SYNCED/STALE/FAILED/RECONCILIATION_REQUIRED) chưa dùng; reconciliation job chưa có.

## 6. Các hệ đích cần sẵn sàng (docs 00/13)
| Hệ | Vai trò SoR | Pilot | Ghi chú |
|---|---|---|---|
| FinERP/ERPNept | Material/Payment/Quotation | PILOT-01/02 (owned bởi XOFFICE tới bước handoff), PILOT-03/04/12 `REQUIRES_CONNECTOR` | Chưa cài → MANUAL_TASK |
| Frappe HR | Tuyển dụng/nhân sự | PILOT-07 (03/04 requires connector) | Chưa cài |
| e-sign | Ký số | PILOT-11 manual signing | Ký số thật là Phase 2 |
| email / IdP / Mattermost | Notify / auth / chat | xuyên suốt | IdP = auth thật (P0 go-live) |

`REQUIRES_CONNECTOR` (PILOT-03/04/12): demo form + preview workflow được, **không cho submit production** khi nguồn chưa cấu hình (docs 00).

## 7. Backlog P1 (ánh xạ CSV) + phụ thuộc P0
| ID | Prio | Nội dung | Acceptance |
|---|---|---|---|
| XO-S1-005 | **P0** | External Action manual/mock/live modes | PILOT-01 hoàn tất bằng manual evidence, không cần FinERP, không bịa MR |
| XO-S1-003 | **P0** | Wire SourceReference/CommandEnvelope/ownerSystem | Contract test PASS |
| XO-S1-002 | **P0** | Idempotency submit/action/task/outbox | Action/webhook trùng không tạo task/event trùng |
| XO-S5-001 | P1 | ConnectorDefinition/Instance + mapping versioned | manual/mock/live cấu hình per tenant |
| XO-S5-002 | P1 | Outbox + DLQ + reconciliation skeleton | Retry + duplicate webhook test PASS |
| XO-S5-003 | P1 | OpenAPI + CloudEvents webhook contract | Contract validation green |

## 8. Kết luận
Nền connector data-driven (catalog + mapping resolver + `ConnectorCommand` persist + `SourceReference`) đã có và tái dùng được. Khoảng cách chính: (1) **bỏ mock bịa chứng từ**, thay bằng **ExternalExecution + MANUAL_TASK** (P0, vi phạm quy tắc bất biến); (2) **Outbox** + tách connector khỏi transaction HTTP; (3) **Webhook inbound** với dedup/replay/signature/DLQ; (4) **ConnectorInstance per-tenant + mapping versioned**; (5) **reconciliation + syncStatus**. Các mục P0 (External Action, SourceReference/Envelope, idempotency) là điều kiện để PILOT-01 chạy đúng chuẩn standalone.
