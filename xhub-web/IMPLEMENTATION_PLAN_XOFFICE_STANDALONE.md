# IMPLEMENTATION PLAN — XOFFICE STANDALONE SaaS

> Docs-first BẮT BUỘC — hoàn tất TRƯỚC khi code (handoff `XTECH_XHUB_XOFFICE_STANDALONE_SAAS_HANDOFF_20260729`).
> Ngày 2026-07-29 · Tenant pilot `xtech` (Tenant 001). Bám `docs/10_IMPLEMENTATION_ROADMAP.md` + `docs/11_ACCEPTANCE_GATES.md` + `IMPLEMENTATION_BACKLOG.csv`.
> Tài liệu này KHÔNG sửa code; nó định nghĩa thứ tự làm + file/endpoint sẽ đụng cho agent code phase sau.

## 1. Nguyên tắc bất biến (từ CLAUDE.md handoff — không được vi phạm khi code)
1. XHub là SaaS dùng chung; X-TECH chỉ là Tenant 001. Mọi query/file/cache/queue/search/AI/backup mang tenant context.
2. XOffice sở hữu thủ tục văn phòng + pre-approval; **KHÔNG tạo Material Request/Payment Request/Employee Advance/Quotation giả**.
3. External chưa sẵn → `MANUAL_TASK` hoặc `WAITING_FOR_CONNECTOR`.
4. Published form/workflow/document version immutable. AI draft-first + human confirm.
5. Không dual-write. Không gọi connector LIVE trong transaction HTTP. Không tin tenant ID browser gửi.

## 2. Vertical slice PILOT-01 "Đề nghị mua sắm" (standalone, không cần FinERP)

Luồng end-to-end chạy hoàn toàn trong XOffice (mục tiêu Sprint 1, chứng minh toàn bộ P0):

1. **Tạo form từ schema** — form node render eForm PILOT-01 (đã có form runtime `/office/workflows/[code]/request`; form seed trong DB).
2. **AI hỗ trợ nhập** — Field Copilot gợi ý, KHÔNG tự submit (`aiDraft` draft-first, `mustRequireHumanApply`).
3. **Condition thật ngưỡng 200tr** — Condition AST an toàn: `amount >= 200_000_000` → nhánh "duyệt cấp cao"; dưới ngưỡng → nhánh thường.
4. **Duyệt / yêu cầu bổ sung / trả lại / ủy quyền / SLA** — dùng `ApprovalTask` + `Delegation` + SLA worker; bổ sung/return là action mới trên task.
5. **ExternalExecution `MANUAL_TASK`** — sau duyệt, thay vì bịa `MR-xxx`, tạo ExternalExecution status `WAITING_MANUAL_EXECUTION` giao `fallbackAssigneeRole`.
6. **Nhập mã tham chiếu thủ công** — người phụ trách nhập mã thực hiện thật → dựng `SourceReference` (ownerSystem=FINERP, syncStatus=LOCAL_ONLY/PENDING), status → COMPLETED.
7. **Audit + outbox + UnifiedWorkItem** — ghi `AuditLog`, `WorkflowEvent`, outbox event, rebuild `UnifiedWorkItem`.
8. **Attachment đúng tenant storage scope** — file nằm `tenants/xtech/...` với checksum (phụ thuộc Sprint 2).
9. **Backup logic riêng tenant `xtech` + restore sandbox** (Sprint 3).
10. **Test `MUST_NOT_LEAK` PASS** ở service/DB/storage/export/restore.

## 3. Thứ tự thực thi P0 → P1 → P2 (ánh xạ backlog + file/endpoint)

### P0 — bắt buộc trước dữ liệu pilot thật

| Thứ tự | Backlog | Việc | File/endpoint sẽ đụng | Acceptance gate (docs 11) |
|---|---|---|---|---|
| 1 | XO-S0-001 | Rotate Anthropic key đã lộ + secret scanning CI | `.env`, CI config, không đưa secret vào repo/backup | Key mới active, key cũ revoked, biên bản quét lịch sử |
| 2 | XO-S1-003 | Wire SourceReference + CommandEnvelope + ownerSystem cho mọi lệnh cross-system | `contracts/source-reference.ts`, `xoffice.service.ts` (`buildSourceRef`, envelope), `schema.prisma` (thêm cột nếu cần) | Contract test PASS |
| 3 | XO-S1-001 | Condition AST an toàn (thêm `in/not_in/contains/is_empty/is_not_empty`, validate theo `condition-ast.schema.json`, chọn nhánh tường minh) | `xoffice.service.ts:634-684` (`evalExpr/nextEdge`), `contracts/condition-ast.schema.json` | PILOT-01 rẽ nhánh đúng dưới/trên 200tr |
| 4 | XO-S1-002 | Idempotency đủ: submit/action/**task/connector/outbox** | `schema.prisma` (`CommandLog` + khóa cho ConnectorCommand/outbox), `xoffice.service.ts:1376-1393` | Action/webhook trùng không tạo task/event trùng |
| 5 | XO-S1-005 | **External Action modes NONE/MANUAL_TASK/REST_API/OUTBOUND_WEBHOOK/EVENT/DEEP_LINK/DISABLED** — bỏ mock bịa chứng từ | `xoffice.service.ts:352-379` (`mockConnectorResult`), `:1237-1310` (`executeServiceCalls`), model `ExternalExecution` mới, `contracts/external-action.schema.json` | PILOT-01 hoàn tất bằng manual evidence, KHÔNG có MR giả |
| 6 | XO-S1-006 | Supplement / return / delegation / SLA pause-resume (working calendar) | `xoffice.controller.ts:138` (`/tasks/:id/act` + action mới), `scheduler.service.ts`, `runSchedulerSweep` | E2E + audit PASS |
| 7 | XO-S1-004 | UnifiedWorkItem rebuild giống hệt (test rebuild idempotent) | `xoffice.service.ts:1441` `rebuildProjection` | Rebuild cho kết quả identical |
| 8 | XO-S2-001/002/003 | DocumentRecord/Version/FileObject dùng chung + object key tenant-scoped + signed URL + checksum/version/capture audit | `schema.prisma` (model mới), storage abstraction mới, `contracts/record-metadata.schema.json`, `tenant-storage-policy.schema.json` | Cross-tenant object access blocked; published version verify được |
| 9 | XO-S3-001..004 | Tenant logical backup package + manifest + file inventory/checksum/mã hóa + restore sandbox/dry-run/apply + rebuild | endpoints `api/openapi-outline.yaml` (`/api/tenants/{tenantKey}/backups`, `/restores/*`), `contracts/backup-manifest.schema.json` | X-TECH package loại `demo-isolation`; restore drill PASS |
| 10 | XO-S6-001 | OIDC/session + tenant membership (gỡ header demo) | `xoffice.controller.ts:5-18` (bỏ default `x-tenant-id`/`x-user-id`), guard mới | Demo identity gỡ khỏi luồng pilot |
| 11 | XO-S6-002 | PostgreSQL RLS cho bảng tenant nhạy cảm | migration RLS (`current_setting('app.tenant_id')` + policy), Prisma middleware set tenant | Raw query isolation test PASS |
| 12 | XO-S6-003 | ACL tenant/document trên mọi AI tool | `xoffice.service.ts` AI tools, retrieval | AI không truy hồi `MUST_NOT_LEAK` |
| 13 | XO-S6-005 | UAT X-TECH Wave 1 + go/no-go | — | Process owners ký |

### P1 — sau khi slice P0 ổn

| Backlog | Việc |
|---|---|
| XO-S2-004 | Classification/retention/disposition queue có phê duyệt |
| XO-S3-005 | Backup/restore admin UI + audit |
| XO-S4-001..004 | Directives/decisions/action items; Service Desk (PILOT-10); Booking (no-show/double-book); Announcement + acknowledgement |
| XO-S5-001..003 | ConnectorInstance per-tenant + mapping versioned; Outbox/DLQ/reconciliation skeleton; OpenAPI + CloudEvents webhook |
| XO-S6-004 | WCAG 2.2 AA audit critical journeys |

### P2 — Phase sau (docs 01 "Phase 2")
Legal hold; advanced disposition/transfer; ký số thật; conversion/migration evidence (ISO 13008); WORM/immutable tier; advanced e-discovery. Full BPMN conformance, ITIL/CMDB, DLP/SIEM: ngoài phạm vi MVP.

## 4. Ánh xạ Sprint (docs 10) → P0/P1
- Sprint 0: XO-S0-001/002 (P0 security + baseline tag) — **đang ở đây** (4 docs này là điều kiện Sprint 0).
- Sprint 1: XO-S1-* (P0 runtime integrity) → chính là vertical slice PILOT-01.
- Sprint 2: XO-S2-* (P0/P1 records + storage).
- Sprint 3: XO-S3-* (P0/P1 backup/restore).
- Sprint 4: XO-S4-* (P1 standalone modules).
- Sprint 5: XO-S5-* (P1 integration framework).
- Sprint 6: XO-S6-* (P0 auth/RLS/AI ACL + P1 a11y + UAT).

## 5. Acceptance gates phải PASS (docs 11) — checklist go-live
- Functional: form/workflow data-driven + versioned; 6 flow standalone chạy không cần external; external có manual fallback; **không object ERP/HR giả**.
- Records: published immutable; checksum+provenance; metadata/classification/retention; export gồm record+metadata+relationships; disposition có duyệt+audit.
- SaaS isolation: mọi table/query/file/queue/cache/search/AI scope theo tenant; `MUST_NOT_LEAK` PASS ở service/DB/storage/export/restore; browser không chọn tenant tùy ý.
- Backup/restore: package chỉ dữ liệu X-TECH; manifest+checksum validate; dry-run sandbox; rebuild projection/search; RestoreAudit đầy đủ; báo cáo drill quý.
- Integration: OpenAPI generated; CloudEvents envelope; command idempotency+correlation; connector modes + mapping version; outbox/DLQ/reconciliation skeleton.
- AI: draft/preview/human confirm; không hành động đặc quyền tự động; ACL tenant+document; audit model/prompt/tool/output.
- UX: loading/empty/error/permission/stale/source-unavailable; keyboard + visible focus; WCAG 2.2 AA critical journeys.

## 6. ADR cần tạo song song (docs 12)
ADR-XO-001 boundary; -002 records model; -003 tenant object storage; -004 dual-layer backup; -005 tenant logical restore; -006 condition AST; -007 External Action modes; -008 CloudEvents webhook/outbox; -009 AI guardrails; -010 RLS + trusted tenant context. Mỗi ADR: context/decision/alternatives/consequences/migration/security-tenant impact/rollback/acceptance evidence.

## 7. Ràng buộc thực thi
- Không hardcode form/workflow vào component; không tin tenant browser gửi; không để AI publish/approve/reject/grant/write secret; không restore thẳng production khi chưa dry-run; không gọi connector LIVE trong HTTP transaction; không gộp file nhiều tenant vào một package.
- Không spawn trùng dev server (giữ 1 server/cổng — `xhub-web:3000`, `xhub-api:4000`).
