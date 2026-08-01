# XHub / X.Space / X.Office — Báo cáo tình trạng dự án
_Cập nhật: 2026-07-29 · dành cho Agent Quản lý dự án_

## 1. Tổng quan
Nền tảng làm việc hợp nhất cho X-TECH gồm **XHub** (workspace điều hành), **X.Space** (collaboration kiểu Slack), **X.Office** (workflow/eForm + AI Copilot). Đang ở giai đoạn **POC/demo chạy được trên hạ tầng thật**, dữ liệu từ canonical seed.

## 2. Kiến trúc & repo (đang chạy)
| Thành phần | Repo | Stack | Port | Trạng thái |
|---|---|---|---|---|
| Frontend | `D:\Code\xhub-web` | Next.js 16 App Router + Tailwind v4 + **design system Tailux** (mua) | 3000 | build xanh, tsc 0 |
| Backend/BFF | `D:\Code\xhub-api` | NestJS + Prisma + **Postgres** (`xhub`) + `@anthropic-ai/sdk` | 4000 | tsc 0, E2E smoke PASS |
| Nghiên cứu/kiến trúc | `D:\Code\xhub` | Docs + ADR + contracts | — | tham chiếu |
| Handoff (nguồn) | `D:\Code\handoff\xhub\*` (symlink Google Drive) | — | — | nhiều bộ |

**Nguyên tắc kiến trúc:** FE không chạm DB (mọi truy cập qua BFF); tenant scope mọi query; version published immutable; AI draft-first + human confirm (không tự submit/approve/publish). Xem ADR-012 (FE Next+Tailux + BFF NestJS) trong `xhub/docs/architecture`.

## 3. Đã hoàn thành (verify xanh)
**Giao diện (33 route, 200):**
- XHub 10 màn (XH-01…10): điều hành, sales, của tôi, inbox, chi tiết thanh toán, công việc, phê duyệt, dự án, app catalog.
- X.Space 10 màn (XS-01…10): home, channel (hội thoại/dự án/khách hàng), thread, DM, trang channel, lists, huddle, workflow.
- 4 module Hub: `/customers` (+360), `/documents`, `/reports`, `/admin`.
- X.Office: `/office/workflows` (WF-01), builder React Flow (WF-02) + AI panel (WF-03) + validate/simulate (WF-07) + mapping editor connector (data-driven) + form builder RJSF (WF-06) + version diff/review (WF-08) + publish/impact (WF-09) + runtime monitor (WF-10) + form runtime tạo request.
- Shell 2 lớp Tailux (rail icon + prime panel + toggle) với 2 chế độ điều hướng `rail-context`/`expanded` (server-authoritative preference), mobile bottom-nav; icon Heroicons (menu) + Tailux (toggle); card header có accent theo ưu tiên; focus-visible a11y.

**Backend (Postgres thật):**
- X.Office: definition/version(immutable)/validate/simulate/publish/request→task→act/audit; **connector catalog + mapping resolver data-driven** + `ConnectorCommand` persist (mock adapter finerp/resource-booking/calendar); **AI Copilot live** (Claude `claude-haiku-4-5`, draft-first) + fallback mock.
- Seed X.Office: 3 workflow (mua sắm/booking/ticket) — **sẽ mở rộng lên 12 pilot** (xem §5).
- Preference API `/api/me/ui-preferences`; seed collections `/api/tenants/:id/collections/*`.
- Tests: `test:isolation`, `test:xoffice`, `test:smoke` (E2E golden path) — PASS.

## 4. Verify gate hiện tại
- `xhub-web`: `tsc --noEmit` 0 lỗi (trừ .next/types generated), `npm run build` exit 0.
- `xhub-api`: `tsc --noEmit` 0 lỗi, E2E smoke 11/11 PASS trên Postgres + AI live.
- `.env` đã cấu hình (Postgres + ANTHROPIC_API_KEY + XOFFICE_AI_LIVE=true). **Lưu ý bảo mật:** API key đã lộ trong hội thoại → nên rotate.

## 5. Xử lý 2 handoff mới 2026-07-29 — ĐÃ XONG vòng đầu (verify xanh)
### A. XOFFICE 12 Pilot Procedures — ✅ đã nạp 12 thủ tục
- `PILOT_PROCEDURES_GAP_ANALYSIS.md` (xhub-web) + adapter `xhub-api/scripts/xoffice-adapt-pilots.mjs` chuyển 12 `workflow.json` + `form.schema.json` (shape handoff) → format nội bộ (auto-layout position, transitions→edges, chèn form node, gắn systemOfRecord/wave/aiPolicy/assignment).
- **DB = 12 workflow (PILOT-01…12) + 12 form**; endpoint `/api/xoffice/forms[/:code]`. E2E smoke PILOT-01 PASS; PILOT-02 (thanh toán) + PILOT-10 (ticket) chạy trọn vòng đời; form runtime `/office/workflows/[code]/request` render form pilot.
- SoR: XOFFICE 01,02,05,06,07,08,09,10,11; FRAPPE_HR 03,04; FINERP 12 (lưu trong metadata).
- **✅ Tầng vận hành P0 (2026-07-29):** (1) **Assignment resolution** roleCode→người thật (role-bindings) + **Delegation** (duyệt thay, audit `onBehalfOf`, chặn 403 người lạ); (2) **SLA/escalation/reminder worker** (`@nestjs/schedule` @Interval + `POST /scheduler/tick` để ép chạy demo/test) → reminder trước hạn, escalation quá hạn (`escalated=true` + audit + notify), advance timer node; (3) **Notification + read-receipt** (`Notification` model + dispatch ở assigned/reminder/escalation/approve/reject/completed/connector; endpoints `/notifications` + `unread-count` + `read`/`read-all`; hint `xspace_card` mock). E2E smoke **32/32 PASS**, isolation 404.
- **✅ Engine phức tạp + FE notification (2026-07-29):** engine multi-token `advanceMulti` thực thi **condition rẽ nhánh + parallelSplit/parallelJoin + subflow** (instance `activeNodes` Json; golden path tuyến tính giữ nguyên); seed `WF-COMPLEX-DEMO` (13 workflow) verify parallel 2 nhánh + join chờ đủ + subflow tạo child. FE: **chuông topbar** (badge unread + popover mark-read + deep-link, poll 60s) + trang `/notifications` + nav "Thông báo".
- **Còn lại (deepen):** connector thật HR/IdP/ký số/email + outbox/webhook (mock); aiAssist-node thực thi trong luồng; subflow async event-driven (hiện synchronous POC); comments/attachments backend; directives/decisions như office record có lifecycle; auth thật (thay header demo); XH-05 task detail đọc task thật; quality gate `03_ACCEPTANCE_GATE`.

### B. System of Record Matrix 120 — ✅ governance done
- `SOR_GAP_ANALYSIS.md` + `adr-sor-001-system-ownership` / `-002-command-event-projection` / `-003-xoffice-to-finerp-handoff` (xhub/docs/architecture) + contract `xhub-api/src/xoffice/contracts/source-reference.ts` (`SourceReference` + `CommandEnvelope`).
- Kết luận: KHÔNG có vi phạm SoR/dual-write hiện hữu; X.Office office-owned đúng, connector→FinERP là delegated command đúng, AI human-confirm đúng, không tái tạo master.
- **✅ P0 đã wire (2026-07-29):** `UnifiedWorkItem` projection **rebuildable** (Prisma model + `GET /api/xoffice/work-items` + `POST /work-items/rebuild`; lazy rebuild-on-read từ ApprovalTask, không dual-write, mở cho nguồn FinERP/HR/Mattermost); mỗi item mang **SourceReference** + ownerSystem + allowedActionsSnapshot; `SourceReference` gắn vào `ConnectorCommand.sourceRef` + result; **CommandEnvelope + idempotency** (`CommandLog` @@unique(tenantId,idempotencyKey)) cho `/requests` & `/tasks/:id/act` (cùng key → 1 instance, replay trả cùng kết quả). E2E smoke **17/17 PASS**, isolation demo-isolation → 404.
- **✅ FE wired (2026-07-29):** Hộp việc `/inbox` đọc trực tiếp `GET /api/xoffice/work-items` (SoR projection, hiển thị badge `SoR: XOFFICE` + deep-link), merge thêm seed non-approval để giữ đa dạng, fallback seed khi API lỗi. Verify: 9 việc từ SoR hiển thị live.
- **Còn lại (P1):** webhook FinERP cập nhật trạng thái sau submit + reconciliation/outbox; rebuild projection theo event thay vì lazy-on-read; nối nguồn projection thật (FinERP/HR/Mattermost); XH-05 detail đọc từ projection/task thật.

## 5c. Handoff mới 2026-07-29 (chiều) — đã xong bước docs-first bắt buộc
### C. XOffice Standalone SaaS (`XTECH_XHUB_XOFFICE_STANDALONE_SAAS_HANDOFF_20260729`)
Gap/plan docs (ở gốc `xhub-web`): `XOFFICE_STANDALONE_GAP_ANALYSIS`, `TENANT_BACKUP_RESTORE_GAP_ANALYSIS`, `INTEGRATION_READINESS_GAP_ANALYSIS`, `IMPLEMENTATION_PLAN_XOFFICE_STANDALONE`.
- **✅ ExternalExecution MANUAL_TASK (đã fix P0 bịa ERP giả):** serviceCall finerp/HR/esign giờ tạo `ExternalExecution` MANUAL_TASK (payload thật, KHÔNG id giả) + endpoint `/external-executions[/:id/reference]` nhập mã tham chiếu thật → SourceReference thật → instance complete. E2E smoke có counter-assert "không còn materialRequestId giả".
- **✅ Mục 1/5 Auth thật (session/JWT + membership, OIDC-ready):** module `auth/` (`POST /api/auth/login|logout`, `GET /me`, `switch-tenant`), cookie `xhub_session` httpOnly, `Membership` model (16 seed), global soft `IdentityGuard` (session → header fallback → default), controllers đọc `@Identity()`. FE: `/login` + logout + topbar user thật. Backward-compat: header `x-user-id/x-tenant-id` vẫn chạy (E2E PASS). Còn: OIDC thật (passwordless dev), enforce authz/roles (guard mới soft).
- **✅ Listing/Pagination/Detail + Footer + scroll dvh:** shell `h-dvh` (header/main-scroll/footer), `DataTable`+`Pagination`+`PaginatedTable`, `/office/instances`(+detail), documents/customers/inbox/workflows → bảng phân trang; backend list endpoints thêm `?page&pageSize` (backward-compat, có `page` → {items,total,page,pageSize}).
- Gap khác (❌): OIDC/session auth thật (đang header demo), **Postgres RLS**, condition AST đầy đủ (thiếu in/contains/is_empty…), records/document model + object storage, tenant backup/restore, webhook inbound + outbox, idempotency mở rộng cho connector/task/outbox.

### D. Identity / Org / Tenant Backup (`XTECH_XHUB_IDENTITY_ORG_TENANT_BACKUP_HANDOFF_20260729`)
Gap/plan docs: `IDENTITY_ORG_GAP_ANALYSIS`, `TENANT_BACKUP_GAP_ANALYSIS`, `IMPLEMENTATION_PLAN_IDENTITY_ORG_BACKUP` + ADR-014/015 (xhub/docs).
- Gap chính (❌): Identity/Org Core như **shared platform domain** (OrgUnit/Position/RoleBinding/Group/PersonProfile UUID — hiện chỉ roleCode→email phẳng); RBAC/ABAC + DataScope; STANDALONE/FEDERATED mode; assignment resolver đa selector + `AssignmentResolution` snapshot; **RLS Postgres**; per-tenant **logical backup/restore** (manifest/checksum/encryption/outbox watermark, no secret) + sandbox restore + remap identity + MUST_NOT_LEAK.
- **Định hướng:** Identity là domain riêng (KHÔNG nhét vào XOffice); không credential trong DB; email không dùng làm khóa (PersonProfile UUID).

## 5d. Chương trình nền tảng bảo mật/đa‑tenant — tiến độ (roadmap 8 mục)
1. ✅ Auth session/JWT + membership (INTERNAL/STANDALONE, adapter‑ready).
2. ✅ **Postgres RLS per‑tenant** — `PrismaService.withTenant/withBypass` (ALS + transaction + SET LOCAL) + `TenantScopeInterceptor`; **35 bảng** ENABLE+FORCE RLS (mốc ban đầu 29, +6 qua Mục 6/8); `npm run test:rls` PASS (MUST_NOT_LEAK 0 rò rỉ); giữ code filter làm backup.
3. ✅ **Identity/Org Core** (module `src/identity`) — PersonProfile UUID/OrgUnit/Position/Group/RoleBinding(subject+scope+effective)/PermissionPolicy/DataScope/AssignmentResolution; resolver đa selector (POSITION/ORG_UNIT_HEAD/DIRECT_MANAGER/ROLE/GROUP) + snapshot; RBAC/ABAC (`/api/identity/permissions/effective|check`, `/assignment/preview`); seed X‑TECH; backward‑compat resolver phẳng.
4. ✅ **Control Plane + Provisioning/Sync** (module `src/controlplane`) — ApplicationDefinition/TenantApplicationInstance (bật x1/x2/xweb), AppAccountBinding + AppRoleMapping(immutable), **ProvisioningCommand outbox** (idempotent + conflict center + retry + reconcile, mock adapter, SourceReference thật); `npm run test:controlplane` (re‑runnable) PASS. Không master user per app.
5. ✅ **Shared MDM + ingestion X2BMS** (module `src/mdm`) — MasterRecord(shared/overlay)/SourceRecord(lineage)/ImportJob/DuplicatePair; pipeline staging→normalize→match→dedup→review→commit (case trùng "X Riverside", **không auto‑merge fuzzy**, commit chặn khi còn duplicate pending); geography shared không nhân bản per‑tenant; `npm run test:mdm` (re‑runnable) PASS.
6. ✅ **Per‑tenant logical backup/restore** (module `src/backup`) — export RLS‑scoped → manifest (row counts + sha256 checksum + outbox watermark), **mã hóa AES‑256‑GCM** (`BACKUP_ENCRYPTION_KEY`), lưu `storage/backups/<tenantId>/`; MUST_NOT_LEAK (deny‑list shared/global + guard regex secret, 0 rò); **restore sandbox/dry‑run** verify checksum/schema + **remap toàn bộ PK/FK/polymorphic/tenantId** + giữ outbox in‑flight (`restoredHold`) + **từ chối ghi đè tenant nguồn**; models `BackupJob`/`RestoreJob`; `npm run test:backup` (re‑runnable, 30 assertions) PASS.
7. ✅ **Tenant Admin UI (TA‑01)** — **15/15 màn** `/admin/*` (tổng quan, users+detail, org chart treegrid+unit, positions, roles+ma trận quyền, data‑scopes+test‑as‑user, delegations, assignment‑resolver+snapshot, backups+detail, restores stepper, audit, tenant settings STANDALONE/FEDERATED); dùng chung `xhub/ui`; `admin.console` → nhóm collapse 12 mục trong workspace **Doanh nghiệp**; backup‑restore wire `/api/backup` có **degrade demo** an toàn (không crash, không đụng DB). tsc 0 lỗi `src/**`.
8. ✅ **Records/webhook/AST/secret‑scan** — (8a) `src/records`: RecordDocument + DocumentVersion **immutable/append‑only**, dedup theo contentHash, object storage folder‑per‑tenant (ENV S3‑ready), guard secret; (8b) `src/webhook`: inbound HMAC‑SHA256 (`WEBHOOK_SIGNING_SECRET`, rawBody) + idempotent dedupe + **transactional outbox** (dispatcher `@Interval` retry/backoff) + `/reconcile`; (8c) `condition-ast.ts` evaluator thuần (and/or/not, eq/ne/gt/gte/lt/lte, in/notIn/contains/exists, `{var}` dot‑path — **no eval**) wire vào branch selection, tương thích 13 workflow; (8d) `scripts/secret-scan.mjs` + `scan:secrets` (fail nếu secret ngoài `.env*`), `SECURITY.md` quy trình rotate, cảnh báo boot theo fingerprint key lộ. **+4 bảng RLS → 35 bảng.** `test:records`/`test:webhook`/`test:condition` PASS.

### Nav IA — icon rail gom về **5 workspace cha** (2026-07-29)
`src/xhub/nav/navigation.model.ts` (ONE model, dùng chung rail + prime panel + mobile bottom‑nav): 13–14 mục phẳng → **5 workspace**: `home` (Trang chủ + Thông báo) · `work` (Hộp việc/Phê duyệt/Chỉ đạo/Dự án) · `space` (X.Space) · `office` (X.Office) · `business` (Khách hàng/Tài liệu/Báo cáo/Ứng dụng/Quản trị). Các màn thật nằm ở panel con (collapse) — rail chỉ là nhóm cha. Icon `business`/`briefcase` thêm vào Heroicons registry.

**Gate hiện tại (verify sau restart sạch, server đơn `node dist/src/main.js`):** api tsc 0 · **35 bảng RLS** · `test:rls` · `test:smoke` (E2E, 13 workflow) · `test:controlplane` · `test:mdm` · `test:backup` · `test:records` · `test:webhook` · `test:condition` · `scan:secrets` — **tất cả PASS**. FE tsc 0 lỗi `src/**`.

## 6. Nợ kỹ thuật / rủi ro
- 🔴 **KEY LỘ — cần người rotate ngay:** `ANTHROPIC_API_KEY` trong `xhub-api/.env` (fingerprint `d9d24a2d90654ea4`) đã lộ trong hội thoại. Rotate tại https://console.anthropic.com/settings/keys, revoke key cũ, thay qua env. `scan:secrets` + cảnh báo boot đã có; hành động thu hồi phải do người làm.
- **Mock, chưa nối thật:** connector ERPNext(Frappe)/Mattermost/FinERP còn mock (outbox provisioning dùng mock adapter); AI mock fallback khi lỗi; webhook dispatcher gửi mock.
- Authz enforcement đã có nhưng **env‑gated off** ở demo (`AUTH_ENFORCE=false`); IdP OIDC thật (Azure AD) mới có seam/mock, chưa nối mạng.
- Type `Document` (seed FE) khác `RecordDocument` (backend mới) — chưa hợp nhất; các page FE vẫn đọc seed collection.
- 2 khung channel trùng vai trò (`ChannelShell` vs `_components/ChannelHeader`) chưa thống nhất.
- `WorkflowNode/Edge` bảng Prisma để trống (JSON là source of truth — MVP).
- Nhiều bản dev server bị spawn trùng khi chạy agent → cần giữ 1 server/cổng; `start:prod` mặc định trỏ sai (`dist/main`) — dùng `node dist/src/main.js`.

## 7. Cách chạy
```bash
cd D:/Code/xhub-api && npm run start:dev   # :4000 (cần Postgres + .env)
```
```bash
cd D:/Code/xhub-web && npm run dev          # :3000
```
Kiểm thử: `cd D:/Code/xhub-api && npm run test:smoke` (golden path), `npm run test:isolation`.

## 8. Đề xuất ưu tiên tiếp theo (cho PM)
> Roadmap nền tảng 8/8 mục ✅ (xem §5d). Từ đây là nối thật + hardening.
1. **P0 (người làm)** Rotate `ANTHROPIC_API_KEY` đã lộ (xem §6) — không đợi được.
2. **P0** Nối connector thật thay mock (FinERP Material/Payment Request, Frappe HR, Mattermost) qua transactional outbox + webhook inbound đã có sẵn; nối AI live ổn định.
3. **P1 — ĐÃ LÀM phần lớn:** enforce authz/roles **env‑gated** (`AUTH_ENFORCE`, mặc định off → demo/smoke không đổi): `@RequirePermission`+`PermissionGuard` dùng RBAC/ABAC engine, gate write endpoints (provisioning/backup/records/identity), 403 khi thiếu quyền, admin/CEO qua; siết auth (session chính, header sau `AUTH_ALLOW_HEADER_IDENTITY`, 401 khi tắt+không session); **OIDC seam** adapter‑ready (MockOidcProvider + route login/callback, `AUTH_OIDC_*`). `test:authz` PASS (allow/deny/401/oidc). **Prod: `AUTH_ENFORCE=true`+`AUTH_ALLOW_HEADER_IDENTITY=false`.** Còn lại: nối IdP Azure AD thật (mới có seam). ✅ FE Admin UI (`/admin/*`) ĐÃ wire live `/api/identity`+`/api/controlplane`+`/api/backup` (server BFF `identity.server`/`controlplane.server`/`backup.server` + proxy `app/api/admin/*`, degrade demo); write‑flow live: tạo backup, restore dry‑run/sandbox, enable app/bind/retry/reconcile (toast+refresh); form kit Tailux `xhub/ui/form/*`. Màn chưa có endpoint (audit/delegations/tenant‑settings) giữ demo + chip.
4. ✅ **Đã hợp nhất `Document` → `/api/records`**: `/documents` + `/documents/[id]` live (list enrich byteSize+versionCount, version history bất biến, tải nội dung, upload/phiên‑bản‑mới qua proxy), seeder `seed:records` (6 tài liệu). Seed collection cũ giữ cho panel liên quan ở màn khác.
5. **P2** Dọn nợ (ChannelShell, a11y audit sâu, visual regression); backup schedule/retention + restore approval workflow production.
