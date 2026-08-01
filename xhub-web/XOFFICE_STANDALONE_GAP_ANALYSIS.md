# XOFFICE STANDALONE — GAP ANALYSIS (Functional Scope + SaaS Multi-tenancy + Runtime/AI)

> Tài liệu docs-first BẮT BUỘC trước khi code (theo `START-HERE.md` handoff `XTECH_XHUB_XOFFICE_STANDALONE_SAAS_HANDOFF_20260729`).
> Chỉ đối chiếu (READ-ONLY), KHÔNG sửa code. Mọi kết luận có evidence từ file thật.
> Ngày: 2026-07-29 · Tenant pilot: `xtech` (Tenant 001) · Tenant kiểm thử isolation: `demo-isolation`.

## 0. Nguồn đối chiếu

| Loại | Đường dẫn |
|---|---|
| Handoff docs | `D:\Code\handoff\Xhub\XTECH_XHUB_XOFFICE_STANDALONE_SAAS_HANDOFF_20260729\docs\02,03,06,08` |
| Backlog | `...\backlog\IMPLEMENTATION_BACKLOG.csv` |
| Contracts | `...\contracts\{external-action,source-reference,record-metadata,tenant-storage-policy,webhook-envelope}.schema.json` |
| Backend hiện có | `D:\Code\xhub-api\src\xoffice\*` + `D:\Code\xhub-api\prisma\schema.prisma` |
| Status | `D:\Code\PROJECT_STATUS_XHUB.md` |
| ADR nền | `D:\Code\xhub\docs\architecture\adr-sor-001/002/003`, `SOR_GAP_ANALYSIS.md` |

---

## 1. Bảng tổng hợp trạng thái (functional + runtime + SaaS)

Chú thích: ✅ ĐÃ CÓ (đủ dùng) · 🟡 CÓ MỘT PHẦN · ❌ THIẾU.

| # | Năng lực (theo docs 02/03/06/08) | Trạng thái | Evidence (file:dòng) |
|---|---|---|---|
| 1 | Workflow definition/version data-driven + immutable published | ✅ | `schema.prisma:27-65` (`Workflow.workingDefinition`, `WorkflowVersion` immutable + checksum); `xoffice.service.ts:746` publish tăng version |
| 2 | Engine multi-token: sequential + parallelSplit/Join + condition + subflow | ✅ | `xoffice.service.ts:1032-1226` (`advanceMulti`), `activeNodes` Json `schema.prisma:118` |
| 3 | SLA + reminder + escalation + timer (pause/resume) | 🟡 | `scheduler.service.ts` (@Interval 30s) + `runSchedulerSweep`; **pause/resume theo lịch làm việc chưa có** |
| 4 | Assignment role→user + Delegation (act on behalf, audit) | ✅ | `schema.prisma:156-197` (`ApprovalTask.onBehalfOf`, `Delegation`); `xoffice.service.ts:~880-900,1902` |
| 5 | Notification + read-receipt (in-app, xspace_card hint) | ✅ | `schema.prisma:201-218` (`Notification`); `notification.service.ts` |
| 6 | UnifiedWorkItem projection rebuildable (không dual-write) | ✅ | `schema.prisma:255-276`; `xoffice.service.ts:1441` `rebuildProjection` |
| 7 | SourceReference + CommandEnvelope + ownerSystem | 🟡 | `contracts/source-reference.ts` type; wired vào `ConnectorCommand.sourceRef` `schema.prisma:146` + `UnifiedWorkItem` `:264-270`. **CommandEnvelope chỉ dùng corr/idempotency, chưa gắn ownerSystem xuyên suốt mọi lệnh** |
| 8 | Idempotency (CommandLog) | 🟡 | `schema.prisma:281-294`; áp cho `/requests` + `/tasks/:id/act` (`xoffice.service.ts:1376-1393,1535,1628`). **THIẾU cho connector command / task / outbox** (spec 06 yêu cầu đủ 5 điểm) |
| 9 | Condition AST an toàn (không JS tự do) | 🟡 | `xoffice.service.ts:634-666` `evalExpr` — có and/or/not + eq/ne/gt/gte/lt/lte. **THIẾU `in/not_in/contains/is_empty/is_not_empty`** (docs 06); branch dựa regex nhãn "có/không" `:678-681` (mong manh); schema `src/xoffice/contracts/condition-ast.schema.json` KHÔNG được enforce runtime |
| 10 | AI inline draft-first (Field Copilot, Path Preview, Approval Brief…) | 🟡 | `xoffice.service.ts` `aiDraft` (Claude live, draft/patch-set); các trợ lý khác (Attachment Checker, Policy citation, SLA/Risk) chưa hiện thực; guardrail ACL tenant/ACL chưa cứng |
| 11 | External Action node modes NONE/MANUAL_TASK/REST_API/OUTBOUND_WEBHOOK/EVENT/DEEP_LINK/DISABLED | ❌ | Không có. `serviceCall` gọi thẳng mock; xem mục 3 |
| 12 | Tenant context tin cậy (không tin browser) | ❌ | `xoffice.controller.ts:5-18` lấy tenant từ header `x-tenant-id` default `tenant-xtech`, user từ `x-user-id` default `user-nam` → **browser tự chọn tenant** (vi phạm CLAUDE.md handoff quy tắc "Không tin tenant ID do browser tự gửi") |
| 13 | Auth thật (OIDC/session/membership) | ❌ | Không có guard/passport/jwt trong `src/xoffice`; status xác nhận "auth thật chưa có, dùng cookie demo + header" (`PROJECT_STATUS_XHUB.md §6`) |
| 14 | PostgreSQL RLS per-tenant | ❌ | Không có policy/`current_setting`/`set_config` trong `prisma/` hay `src/`. Chặn tenant chỉ ở tầng service (`@@index([tenantId])` + filter thủ công) |
| 15 | Tenant-aware cache / queue / search / AI retrieval | ❌ | Chưa có lớp cache/queue/search; AI retrieval chưa gắn tenant/doc ACL |
| 16 | Records & document model (DocumentRecord/Version/FileObject) | ❌ | Không có model nào trong `schema.prisma`; xem `RECORDS` gap ở tài liệu backup/integration liên quan |
| 17 | Tenant-scoped object storage + signed URL + checksum + malware scan | ❌ | Không có code storage (grep `s3/minio/signedUrl/malware` = 0 hit) |
| 18 | Webhook inbound + outbox worker | ❌ | Không có; connector chạy đồng bộ trong HTTP transaction (mục 3) |
| 19 | Secret rotation + secret scanning CI | ❌ | API key đã lộ, chưa rotate; chưa có secret scanning (`PROJECT_STATUS_XHUB.md §4,§6`) |

---

## 2. ĐÃ CÓ — nền tảng dùng lại được (không phải build lại)

- **Runtime workflow lõi**: `advanceMulti` xử lý đúng condition rẽ nhánh, parallelSplit/Join (chờ đủ token), subflow; golden path tuyến tính giữ nguyên. Engine + `WorkflowVersion` immutable + checksum là nền vững cho PILOT-01.
- **Tầng vận hành phê duyệt**: assignment role→người thật, delegation có audit `onBehalfOf` + chặn 403 người lạ, SLA worker (reminder/escalation/advance timer), notification + read-receipt.
- **Governance SoR (P0 đã wire vòng trước)**: `UnifiedWorkItem` projection rebuildable từ `ApprovalTask` (không dual-write); `SourceReference` gắn `ConnectorCommand.sourceRef` + result; `CommandEnvelope` + `CommandLog` idempotency cho create/act.
- **Connector data-driven**: catalog + mapping resolver (`resolveConnectorPayload` `xoffice.service.ts:308-344`), `ConnectorCommand` persist với `attempts`, `status`, `sourceRef`.
- **AI Copilot live**: `aiDraft` Claude draft-first, patch-set có `mustRequireHumanApply` (`xoffice.types.ts:225-232`).

## 3. THIẾU — khoảng cách chính (chi tiết + tác động)

### 3.1 External Action / ExternalExecution + "chứng từ ERP giả" (P0, nghiêm trọng)
- Hiện `serviceCall` → `executeServiceCalls` (`xoffice.service.ts:1237-1310`) gọi `mockConnectorResult` **bịa** `materialRequestId: "MR-xxx", system: "FinERP"` (`:363-369`) và `reservationId`, tức **tạo chứng từ ERP giả** — vi phạm trực tiếp CLAUDE.md handoff quy tắc 4 ("Không tạo Material Request/Payment Request… giả") và acceptance gate 11 ("No fake ERP/HR objects").
- THIẾU hoàn toàn khái niệm `ExternalExecution` với `executionMode` (NONE/MANUAL_TASK/REST_API/OUTBOUND_WEBHOOK/EVENT/DEEP_LINK/DISABLED) và `status` (NOT_REQUIRED/WAITING_MANUAL_EXECUTION/WAITING_CONNECTOR/PROCESSING/COMPLETED/FAILED/CANCELLED) theo `contracts/external-action.schema.json`.
- THIẾU `fallbackAssigneeRole`, `completionEvidenceRequired`, `manualEvidence[]`, và việc gắn `SourceReference` từ **mã tham chiếu nhập tay** (thay vì bịa).
- **Cần**: node External Action với default `MANUAL_TASK` → sinh task "người phụ trách nhập mã tham chiếu thực hiện thủ công"; connector `MOCK/LIVE` chỉ qua outbox worker NGOÀI transaction HTTP.

### 3.2 Condition AST thật theo ngưỡng 200tr (P0)
- `evalExpr` thiếu toán tử tập hợp/chuỗi/rỗng (`in/not_in/contains/is_empty/is_not_empty`) và không validate theo schema `condition-ast.schema.json` khi publish/runtime.
- Việc chọn nhánh dựa regex nhãn cạnh (`/^(có|yes|true)$/i`) dễ vỡ khi nhãn tiếng Việt khác. Cần map nhánh theo `edge.label`/`condition outcome` tường minh (edge có `when: true/false` hoặc case).
- Ngưỡng 200.000.000đ hiện chạy được qua `gte` nếu AST đúng, nhưng chưa có test khẳng định branch dưới/trên ngưỡng (backlog `XO-S1-001`).

### 3.3 Auth thật + tenant context tin cậy + RLS (P0, go-live gate)
- Header `x-tenant-id`/`x-user-id` là lỗ hổng isolation ở tầng transport: browser gán tenant tùy ý. Cần resolve `tenantId/actorId/roles/orgUnit/correlationId/classification` từ session/membership (docs 03).
- RLS Postgres chưa bật → chỉ có defense ở 1 lớp (service filter). Docs 08 yêu cầu defense-in-depth: policy layer + RLS + storage namespace + queue/cache/search scope + connector scope + isolation test.

### 3.4 Records/document model + tenant storage (P0 nền cho PILOT file)
- Không có `DocumentRecord/DocumentVersion/FileObject/AttachmentReference/RecordCapture` (docs 05) → attachment PILOT-01 chưa có chỗ lưu đúng tenant scope, chưa checksum/version/capture audit. File namespace `s3://xhub-data/tenants/xtech/...` (docs 04) chưa tồn tại.

### 3.5 Idempotency đủ 5 điểm + Outbox/Webhook (P0/P1)
- `CommandLog` mới phủ create/act. Connector command, external task completion, outbox event chưa idempotent (spec 06 "Idempotent command"). `ConnectorCommand` có `attempts` nhưng không có khóa dedup.
- Chưa có Outbox (ghi business+audit+outbox cùng transaction, worker xử lý ngoài HTTP) và Webhook inbound (`POST /api/integrations/webhooks/:connectorKey/:tenantKey` với dedup event id + replay protection + signature + tenant resolution + DLQ).

### 3.6 Multi-tenant context ở cache/queue/search/AI (P1/P0-AI)
- Chưa có hạ tầng cache/queue/search; khi thêm phải mang tenant key. AI tool phải áp ACL tenant + document (backlog `XO-S6-003`, không được truy hồi `MUST_NOT_LEAK`).

---

## 4. Backlog P0/P1/P2 (ánh xạ `IMPLEMENTATION_BACKLOG.csv`)

| Backlog ID | Prio | Gap mục | Kết quả cần đạt |
|---|---|---|---|
| XO-S0-001 | P0 | 3.3/§1-19 | Rotate Anthropic key + secret scanning CI, ghi biên bản quét lịch sử repo |
| XO-S0-002 | P0 | — | Tag `v0.4.0-poc-baseline` sau khi 4 docs xong |
| XO-S1-001 | P0 | 3.2 | Condition AST an toàn: PILOT-01 rẽ nhánh đúng dưới/trên 200tr |
| XO-S1-002 | P0 | 3.5 | Idempotency vào submit/action/task/outbox — action trùng không tạo task/event trùng |
| XO-S1-003 | P0 | 3.1/§7 | Wire SourceReference + CommandEnvelope + ownerSystem qua contract test |
| XO-S1-004 | P0 | §6 | UnifiedWorkItem rebuild cho kết quả giống hệt (đã có nền, cần test rebuild) |
| XO-S1-005 | P0 | 3.1 | External Action manual/mock/live — PILOT-01 hoàn tất bằng manual evidence, KHÔNG cần FinERP, KHÔNG bịa MR |
| XO-S1-006 | P0 | 3.3/§3 | Supplement/return/delegation + SLA pause/resume E2E + audit |
| XO-S2-001..003 | P0 | 3.4 | DocumentRecord/Version/FileObject dùng chung + object key tenant-scoped + signed URL + checksum/version/capture audit |
| XO-S2-004 | P1 | 3.4 | Classification/retention/disposition queue có phê duyệt |
| XO-S6-001 | P0 | 3.3 | OIDC/session + membership, gỡ identity demo khỏi luồng pilot |
| XO-S6-002 | P0 | 3.3 | RLS Postgres cho bảng tenant nhạy cảm — raw query isolation test PASS |
| XO-S6-003 | P0 | 3.6 | ACL tenant/document trên mọi AI tool — không truy hồi MUST_NOT_LEAK |

## 5. Kết luận

XOffice đã có **runtime + tầng vận hành phê duyệt + governance SoR** đủ mạnh làm nền cho vertical slice PILOT-01. Khoảng cách lớn nhất và ưu tiên cao nhất là: (1) **thay mock "chứng từ ERP giả" bằng ExternalExecution MANUAL_TASK** (đang vi phạm quy tắc bất biến); (2) **Condition AST thật** cho ngưỡng 200tr; (3) **auth thật + tenant context tin cậy + RLS** trước dữ liệu pilot thật; (4) nền **records/document + tenant storage**; (5) **idempotency đủ + outbox/webhook**. Chi tiết backup/restore và integration ở 2 tài liệu chuyên đề kèm theo.
