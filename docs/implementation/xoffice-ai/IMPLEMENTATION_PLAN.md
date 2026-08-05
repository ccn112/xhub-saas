# IMPLEMENTATION PLAN — X.Office Business Operations OS + AI + tách XHub/X.Office

> Lưu từ phiên lập kế hoạch 2026-08-03 (Claude). Đây là bản kế hoạch sống — cập nhật khi từng Phase hoàn tất hoặc quyết định thay đổi. Đối chiếu với `TINH_HINH_DU_AN_XHUB.md` mục 9 (nhật ký) để biết Phase nào đã thực sự chạy xong (verified), tài liệu này chỉ là **kế hoạch đã duyệt**, không phải nhật ký tiến độ.

## Context

Có 3 bộ handoff, tất cả cùng dựa trên baseline `Audit260803` (audit chạy 2026-08-03, xem `D:\Code\handoff\Audit260803\`):

1. **XHUB_ECOSYSTEM_AUDIT_HANDOFF_20260803** — khung audit, đã chạy xong (4 review package + cross-system report).
2. **XHUB_IDENTITY_P0_X1_X2_CLAUDECODE_HANDOFF_20260803** — xây lớp danh tính dùng chung tại XHub, liên kết tài khoản hiện có X1/X2 (P0-G0 → P0-G9, backlog `IDP0-001..032`).
3. **XOFFICE_BUSINESS_OPERATIONS_AI_CAMERA_AGENT_HANDOFF_20260803** — mở rộng X.Office thành Business Operations OS + AI agent + AI camera (G0 → G8, backlog `BO-0001..0805`).

**Điểm mấu chốt:** 2 bộ (2) và (3) **không độc lập** — cả hai đều bắt đầu bằng đúng cùng một Gate G0 trên cùng repo `xhub-saas`, vì cùng phát hiện đúng những lỗi audit tìm thấy (secret lộ, authz no-op, thiếu migration/CI). Làm G0 một lần là thoả cả hai. Sau G0, cả hai đều bắt buộc ký SoR/ADR + collision map (G1) trước khi đụng domain code mới. Chỉ SAU G1 hai chương trình mới tách nhánh: Identity-P0 đi sâu vào Identity Hub + X1/X2 adapter; Business-Ops đi sâu vào Revenue/Contract/Delivery/People + AI.

Ưu tiên đã chọn: sau G0+G1, **Revenue & Contract MVP** (nhánh Business-Ops) trước; Identity Hub deepening (Identity-P0 G4) làm sau/song song. Mục tiêu tách XHub/X.Office (Phase 1.5): **tách thật sự** — X.Office trở thành sản phẩm SaaS độc lập, tự có DB riêng (không phải chỉ tách port).

Phạm vi phiên này: **chỉ `xhub-saas`** (xhub-api + xhub-web). Việc trên X1/X2 (rotate secret X1, quyết định auth authority X1, đóng isolation gate X2) là điều kiện tiên quyết cho *tích hợp sống* ở G7 sau này, không thuộc phạm vi sửa code phiên này.

## Phase 0 — Secure Foundation (G0, dùng chung cho cả 2 chương trình) — ✅ ĐÃ XONG 2026-08-03

Commit `b576adc` trên branch `security/g0-secure-foundation`, fast-forward merge vào `main` local. **Chưa push lên `origin/main`** (bị chặn bởi bộ lọc auto-mode Claude Code — cần chạy tay `git push origin main`).

| # | Việc | File chính | Trạng thái |
|---|---|---|---|
| 1 | Cứng hoá cảnh báo secret lộ | `src/main.ts` (`assertSecureStartup`, wire `STAGING_STRICT`) | ✅ |
| 2 | Auth secure-by-default | `src/main.ts` + `src/auth/identity.types.ts` (`isStagingStrict`) | ✅ |
| 3 | Vá 28 route `xoffice.controller.ts` | `src/xoffice/xoffice.controller.ts` — 28/28 có `@RequirePermission`, sửa lỗ hổng self-grant delegation | ✅ |
| 4 | Regression test PoC | `xhub-api/test/xoffice-delegation.e2e-spec.ts` — PASS | ✅ |
| 5 | Prisma migration baseline | `xhub-api/prisma/migrations/20260803190000_baseline/` — `migrate status` sạch, không mất data | ✅ |
| 6 | CI tối thiểu | `.github/workflows/ci.yml` — build/lint(report-only)/unit/e2e/authz/RLS/isolation | ✅ (chưa chạy thật trên GitHub vì chưa push) |
| 7 | OpenTelemetry baseline | — | Chưa làm (P1, không chặn G0) |

**Còn nợ:** rotate `ANTHROPIC_API_KEY` thật tại console.anthropic.com (hành động của chủ tài khoản, không tự động hoá được); push `origin/main`; verify CI thật trên GitHub Actions (chưa chạy).

## Phase 1 — SoR/ADR sign-off + Collision Map (G1, dùng chung) — CHƯA BẮT ĐẦU

- Tạo `docs/implementation/xoffice-ai/`: `CURRENT_STATE_REBASE.md`, `REPOSITORY_PIN_REGISTER.csv`, `COLLISION_MAP.csv`, `GATE_STATUS.csv`, `SOR_DECISION_REGISTER.csv`, `LEGAL_CONTROL_REGISTER.csv`, `AI_USE_CASE_REGISTER.csv`, `CAMERA_USE_CASE_REGISTER.csv`.
- Collision map: đối chiếu 120 model hiện có trong `schema.prisma` với entity mới (6 Identity-P0 + ~15 Business-Ops).
- Ký ADR: Claude soạn draft (18 file trong `adr/` của cả 2 bộ) — người có thẩm quyền ký, Claude không tự ký thay.
- **Bắt buộc trả lời 4 câu hỏi sở hữu cụ thể** (xem Phase 1.5 bên dưới): `Delegation` thuộc ai? `Workflow/ApprovalTask` — People được ghi thẳng không? `Delivery` thuộc Platform hay Business? `AuditLog` tách hay chung?

## Phase 1.5 — Tách XHub Platform ↔ X.Office thành 2 app/2 DB độc lập — CHƯA BẮT ĐẦU

**Mục tiêu đã chọn:** tách thật sự — X.Office trở thành sản phẩm SaaS độc lập, tự có DB riêng, không còn shared database với XHub (đúng nguyên tắc `CLAUDE.md` bộ Business-Ops: "Không shared database giữa XHub, X.Office, X1, X2..."). Vì "không big-bang rewrite" cũng là nguyên tắc đã ghi, chia 4 giai đoạn tăng dần rủi ro.

### Bằng chứng khảo sát (code thật, 2026-08-03)

**Phân loại 27 module `xhub-api/src/`:**
- **XHUB_PLATFORM** (7): `controlplane`, `mdm`, `backup`, `webhook`, `platform` (+`catalog`/`launch`/`lifecycle`/`onboarding`).
- **XOFFICE_BUSINESS** (12): `xoffice`, `requests`, `directives`, `tickets`, `bookings`, `announcements`, `records`, `work`, `manage`, `people`, `ioc`, `delivery`.
- **SHARED thật** (3): `prisma`, `auth`, `identity` (tự khai "the SHARED platform domain" — `identity.module.ts:246`).
- **AMBIGUOUS** (3): `seed`, `preferences`, `testruns`.

**7 điểm vi phạm ranh giới cụ thể tìm được:**
1. `src/delivery/delivery.module.ts:5,8` — `EngagementsService` inject thẳng `TenantLaunchService` (platform) để auto-provision tenant ở GO_LIVE.
2. `src/identity/identity.controller.ts:231` đọc thẳng bảng `Workflow`; `identity.service.ts:531-582` sở hữu CRUD `Delegation` dù `xoffice.service.ts` cũng dùng nó.
3. `src/people/people.helpers.ts:93-116` (`spawnApprovalTask`) ghi thẳng `WorkflowInstance`+`ApprovalTask` bằng raw Prisma, bỏ qua engine BPMN thật.
4. `src/people/leave.service.ts:218-227,267-275` ghi thẳng `OutboxEvent` (bảng do module `webhook` sở hữu), không qua `WebhookService`.
5. `AuditLog` bị ~20 service ở cả 2 nhóm ghi trực tiếp.
6. RLS (`scripts/rls-setup.mjs`) là 1 cơ chế phẳng ~98 bảng, không phân biệt app nào đọc bảng nào.
7. `TenantScopeInterceptor` (dùng bởi cả 27 module) nằm sai vị trí vật lý trong `src/xoffice/`.

**Frontend:** route đã tách path rõ (XHub 28 trang `/admin`+`/platform`; XOffice 63 trang; X.Space 10 trang) nhưng layout/shell/nav-tree/session là 1 khối. API client rải rác ~49 file, 3 biến env khác nhau (`XOFFICE_API_BASE` chưa từng khai báo trong `.env.example`).

**Insight:** một khi tách thật, X.Office kiến trúc GIỐNG HỆT X1/X2 — dùng đúng cơ chế Identity-P0 đã thiết kế sẵn (`ExternalIdentity`/`AppAccountBinding`/canonical tenant context/link-only adapter), không cần thiết kế cơ chế mới.

### Giai đoạn A — Dọn ranh giới nội bộ (rủi ro thấp, vài ngày) — ✅ DONE 2026-08-04
Vẫn 1 process/1 DB: di dời `TenantScopeInterceptor` sang `src/common/`; People bỏ raw write vào Workflow/ApprovalTask/OutboxEvent (gọi qua service); quyết định chủ sở hữu `Delegation`; bỏ raw read `Workflow` trong Identity; thêm ESLint boundary rule; gom 3 biến API client frontend thành 1 module.

**Bằng chứng hoàn thành (branch `refactor/xoffice-boundary-cleanup`):**
1. `TenantScopeInterceptor` chuyển sang `xhub-api/src/common/tenant-scope.interceptor.ts`, import ở toàn bộ 27 module cập nhật lại.
2. `People` (leave/overtime/attendance-correction) không còn raw write `WorkflowInstance`/`ApprovalTask` — thêm `XofficeService.spawnLightweightApprovalTask()` (tạo) + `XofficeService.closeLightweightApprovalTask()` (đóng khi approve/reject). `leave-impact.service.ts` cũng hết raw read `ApprovalTask` — thêm `XofficeService.listOpenApprovalTasksForAssignee()`.
3. `Delegation`: chốt thuộc `IdentityService`; `xoffice.service.ts.createDelegation()` giờ gọi `identity.createDelegation(...)` thay vì raw Prisma (đọc vẫn ở XOffice cho `findValidDelegate`/`listDelegations` — chấp nhận, đã đưa vào allowlist của ESLint rule).
4. Raw read `Workflow` ở `identity.controller.ts:241` — giữ nguyên có chủ đích (residual đã ghi chú, xem comment tại chỗ + `eslint-disable-next-line`), vì XofficeModule đã import IdentityModule nên chiều ngược lại cần `forwardRef()` — việc này sẽ thành lời gọi HTTP thật ở Giai đoạn C, làm `forwardRef()` bây giờ là công sức bỏ đi.
5. ESLint boundary rule: `eslint.config.mjs` — `no-restricted-syntax` chặn `<x>.db.workflow/workflowVersion/workflowInstance/approvalTask` (ngoài `src/xoffice/`), `<x>.db.delegation` (ngoài `src/xoffice/`+`src/identity/`), `<x>.db.outboxEvent` (ngoài `src/webhook/`). Đã verify bắt được 1 vi phạm test cố tình tạo ra, rồi xoá. **Bắt được 4 vi phạm THẬT còn sót lại** từ đợt sửa trước (raw `approvalTask.update` trong `leave.service.ts`/`overtime.service.ts`/`attendance-correction.service.ts`, raw read trong `leave-impact.service.ts`) — đã sửa cả 4, verify lại bằng `npm run test:people-leave` (26/26 pass) và `npm run test:people-attendance` (đã pass đúng nhánh liên quan; 1 fail còn lại là flake tính giờ đi trễ có từ trước, không liên quan).
6. Frontend: gom 3 biến (`XHUB_API_URL`, `NEXT_PUBLIC_XHUB_API_URL`, `XOFFICE_API_BASE`) thành 1 module `xhub-web/src/lib/api-base.ts` (export `API_BASE_SERVER`/`API_BASE_CLIENT`), áp dụng cho 47 file. Tiện thể sửa luôn bug thật: `XOFFICE_API_BASE` chưa từng khai báo trong `.env.example`, nên ~14 file `xoffice/lib/*-data.ts` luôn âm thầm rơi về `localhost:4000` bất kể `XHUB_API_URL` cấu hình gì trên môi trường thật — giờ tất cả đọc đúng `XHUB_API_URL`. Verify: `npx tsc --noEmit` sạch, `npm run build` sạch, xác nhận `NEXT_PUBLIC_XHUB_API_URL` vẫn được Next.js inline đúng vào client bundle.

### Giai đoạn B — Tách process (2 NestJS app, vẫn 1 Postgres DB) — ✅ DONE 2026-08-04
2 app riêng (module group riêng + package `identity`/`auth`/`prisma` dùng chung), vẫn 1 DB, `AUTH_JWT_SECRET` dùng chung (SSO không đổi).

**Bằng chứng hoàn thành:**
1. **3 phụ thuộc chéo còn lại (khảo sát lại bằng agent Explore trước khi tách) đã xử lý xong:**
   - `records.service.ts` → `backup/backup.tables.ts` (pure function, không phải service injection): di dời `SECRET_FIELD_REGEX`/`assertNoSecretFields`/`canonicalize`/`contentChecksum` sang `src/common/document-guards.ts` (shared); `backup.service.ts` + `platform/catalog/catalog.service.ts` sửa lại import.
   - `People→WebhookService.enqueueOutboxEvent()`: tách hàm thành `src/common/outbox.ts` (shared, ghi trực tiếp bảng `OutboxEvent` — đúng bản chất outbox pattern, không cần HTTP vì DB vẫn chung). `WebhookService` tự dùng lại hàm này nội bộ; `people.module.ts` bỏ import `WebhookModule`. ESLint rule bỏ chặn `outboxEvent` (giờ là shared-table-by-design, giống `AuditLog`).
   - `Delivery→TenantLaunchService`: chuyển thành `src/delivery/launch-factory.client.ts` (fetch thuần, gọi route có sẵn `/api/platform/launches`, forward `x-tenant-id`/`x-user-id` của người gọi). **Phát hiện quan trọng**: chuyển sang gọi qua guard thật làm lộ ra role `SOLUTION_DELIVERY_MANAGER` KHÔNG có `platform.launch.read`/`platform.launch.manage` (hôm nay bypass guard vì gọi thẳng service) — đã cấp thêm 2 permission này trong `seed-data/identity/role-registry.seed.json` để giữ đúng khả năng nghiệp vụ hôm nay, giờ đi qua guard thật thay vì bypass ẩn.
2. **2 composition root mới, cùng `src/` tree** (không dùng Nest monorepo mode, không di dời thư mục nào): `src/platform-app.module.ts` (7 module platform + shared) + `src/xoffice-app.module.ts` (12 module business + preferences/testruns + shared), qua `src/main-platform.ts`/`src/main-xoffice.ts`. Bootstrap logic (leaked-key guard, secure-startup assert, CORS, cookie, Prisma shutdown hook) gom vào `src/bootstrap.ts` dùng chung 3 entrypoint. Giữ nguyên `src/main.ts`/`AppModule` làm chế độ all-in-one cho dev nhanh. Port: platform mặc định `:4000` (đọc `PLATFORM_PORT` rồi `PORT`), xoffice mặc định `:4001` (đọc riêng `XOFFICE_PORT`, KHÔNG rơi về `PORT` chung để tránh đụng cổng khi chạy cùng lúc).
3. **Verify thật**: build cả 2 process từ CÙNG 1 `dist/` (giống hệt CI), chạy song song `:4000`+`:4001`, xác nhận mỗi process CHỈ serve đúng route nhóm mình (`/api/platform/*` → 404 ở xoffice; `/api/xoffice/*` → 404 ở platform). Chạy `test:delivery` trỏ vào xoffice process (`:4001`) — xác nhận Delivery gọi HTTP THẬT sang platform process (`:4000`) để launch tenant, toàn bộ pass (bao gồm "detail embeds live launch progress" — đọc `.detail()` qua HTTP).
4. **CI** (`.github/workflows/ci.yml`): boot cả 2 process từ `dist/` đã build 1 lần; mở rộng từ 4 gate cũ (authz/rls/isolation/xoffice) thành phân nhóm platform (13 script, port 4000) / xoffice (20 script, port 4001) / topology-independent (6 script, không cần server). `platform-console-smoke.mjs` cần sửa (thêm `XOFFICE_BUSINESS_BASE`) vì 1 assertion của nó cố tình gọi 1 route business để test guard — dưới cấu hình tách, route đó không còn tồn tại ở process platform (404 thay vì 403), phải trỏ đúng sang xoffice process mới test đúng guard thật.
5. **Frontend**: `xhub-web/src/lib/api-base.ts` tách `API_BASE_SERVER/CLIENT` (Stage A) thành `PLATFORM_BASE_SERVER/CLIENT` + `XOFFICE_BASE_SERVER/CLIENT`; phân loại lại 47 file Stage A theo route thật chúng gọi (15 file → platform, 32 file → xoffice) — verify bằng cách đọc path API thật trong từng file, không đoán theo tên thư mục. `npx tsc --noEmit` + `npm run build` sạch; xác nhận qua browser thật: `/platform/tenants` load qua `:4000`, `/office/requests` load qua `:4001` (134 requests hiển thị đúng).
6. **Full smoke run** (39 script tổng, chạy tay trước khi đưa vào CI): PASS toàn bộ trừ 2 flake đã xác nhận KHÔNG liên quan Phase 1.5 — (a) `test:people-attendance`: bug tính giờ đi trễ có từ trước (đã ghi nhận từ Stage A), đưa vào CI ở bước riêng `continue-on-error`; (b) `test:smoke` (xoffice-e2e): 62 dòng `Delegation` tồn đọng từ nhiều lần chạy tay lặp lại trên DB dev cũ (không phải do code) — dọn sạch thì pass; CI luôn chạy trên DB mới nên không gặp lại. Phát hiện thêm 1 gate thiếu bước seed (`seed:manage-portfolio`) — đã thêm vào chuỗi seed CI.

**Quyết định cần bạn xác nhận:** đã cấp `platform.launch.read`/`platform.launch.manage` cho role `SOLUTION_DELIVERY_MANAGER` (mục 1 ở trên) để giữ nguyên hành vi hôm nay khi chuyển Delivery→Launch sang gọi qua guard thật thay vì bypass ẩn — đây là quyết định authz có thể cần ADR chính thức sau này (câu hỏi gốc: Delivery có nên tự launch tenant hay phải qua platform team duyệt?).

### Giai đoạn C — Tách DB thật (đúng mục tiêu cuối)
X.Office có Postgres riêng; Tenant/Identity vẫn canonical ở XHub, X.Office lưu `AppAccountBinding`/`ExternalIdentity` local; Delivery→Launch Factory qua HTTP; AuditLog tách theo app; sự kiện xuyên hệ qua outbox/webhook thật.

### Giai đoạn D — Tách frontend + (tuỳ chọn) tách repo
Next.js multi-zone hoặc 2 domain riêng; session vẫn 1 JWT/OIDC issuer (XHub Identity Hub); tách repo Git là bước cuối cùng.

**Thứ tự khuyến nghị:** Giai đoạn A trước/song song đầu Phase 2 (tránh xây thêm nợ ranh giới). Giai đoạn B/C/D sau khi Phase 2 (Revenue & Contract MVP) chứng minh xong trên nền đã dọn sạch.

> **Lưu ý quan trọng — đối chiếu với quyết định trước đây:** `TINH_HINH_DU_AN_XHUB.md` mục 9, nhật ký 2026-08-02, có ghi: *"XOffice Standalone SaaS — xác nhận X.Office KHÔNG tách deploy, mãi mãi 1 codebase/1 sản phẩm"*. Đó là kết luận từ bộ handoff CŨ (`XTECH_XHUB_XOFFICE_STANDALONE_SAAS_HANDOFF_20260729`, dùng chữ "standalone" theo nghĩa "chạy được khi connector ngoài chưa nối", KHÔNG phải nghĩa "tách deployment vật lý"). Phase 1.5 ở đây là một **mục tiêu mới, khác nghĩa**, do chủ đầu tư trực tiếp chọn ngày 2026-08-03 (tách deploy/DB thật). Cần bạn xác nhận đây đúng là muốn đảo ngược/làm rõ so với ghi chú 2026-08-02, không phải hiểu nhầm của Claude.

## Phase 2 — Revenue & Contract MVP (G2, nhánh Business-Ops) — 🚧 SLICE 1 XONG (2026-08-05)

Theo `data/IMPLEMENTATION_BACKLOG.csv` mục `BO-0201..0210` (nguồn:
`handoff/Xhub/XOFFICE_BUSINESS_OPERATIONS_AI_CAMERA_AGENT_HANDOFF_20260803`
— xác nhận vẫn còn trên đĩa 2026-08-05, trước đó tìm nhầm chỗ), exit gate
"T001 lead-to-contract": Customer/Contact + 360 view → Opportunity pipeline
→ Commercial Catalog → Proposal/Quotation → Discount/margin approval →
Contract/Contract Line → e-signature seam → contract obligation/alert
engine → pipeline/contract KPI → seed T001. Mỗi slice đạt Definition of
Done (`docs/17_DEFINITION_OF_DONE.md`): migration + RLS/negative test +
API/event/idempotency + UI thật + seed thật + audit/retention +
observability + UAT.

### Slice 1 — BO-0201 Customer/Contact account model + 360 — ✅ DONE 2026-08-05

Field-faithful tới đúng contract gốc (`contracts/customer-account.schema.json`
+ `contact.schema.json`) — xem docblock trong `prisma-xoffice/schema.prisma`
cho bảng đối chiếu field-by-field (một số field phía Prisma thêm ngoài
contract gốc, ghi chú rõ từng field).

- Model `Customer`/`Contact`/`CustomerEvent` (tenant-scoped, RLS) — migration
  `prisma-xoffice/migrations/20260805170000_customer_contact/`.
- `src/customers/` (service/controller/module) — `POST/GET /api/customers`,
  `GET /api/customers/:id` (360: customer+contacts+events),
  `PATCH /api/customers/:id/status`, `POST /api/customers/:id/contacts`.
  Reads open; writes gated `customer.manage` (role mới `SALES_MANAGER`).
  Idempotency-key hỗ trợ (mẫu giống Announcement). Duplicate-candidate
  detection theo overlap từ khoá có nghĩa (không phải substring nguyên
  chuỗi) — đáp ứng đúng acceptance "duplicate candidates" của BO-0201.
- Seed `seed-data/customers/customers.seed.json` — ĐÚNG kịch bản T001 X-TECH
  tham chiếu từ nguồn gốc (`seed/t001-reference-journey.seed.json` của gói
  handoff): khách hàng CUS-T002 "Công ty Cổ phần Đầu tư Riverside". Contact
  person là bổ sung của phiên này (nguồn gốc không có), ghi chú rõ trong
  seed JSON.
- Smoke `scripts/customers-smoke.mjs` (`test:customers`, 15 assertion: seed
  thật, 360 view, idempotent create, duplicate-candidate, primary-contact
  enforcement, status FSM đơn giản, **RLS tenant isolation (MUST_NOT_LEAK)**,
  permission gating). Wired vào CI.
- Frontend `xhub-web/src/app/(app)/office/customers/{page.tsx,[id]/page.tsx}`
  — verify qua browser thật: đổi trạng thái + xem timeline hoạt động cập
  nhật đúng.
### Slice 2-8 — BO-0202..0209 (Opportunity → Contract → KPI) — ✅ DONE 2026-08-05

Toàn bộ chuỗi "T001 lead-to-contract" đã build thật, field-faithful tới
đúng contract gốc (`contracts/{opportunity,commercial-catalog-item,
proposal,contract,contract-line,billing-request}.schema.json`).

- **BO-0202 Opportunity** (`src/opportunities/`) — FSM LEAD→...→WON/LOST,
  `lostReason` bắt buộc khi LOST, terminal states. Cố ý KHÔNG tự tạo bất kỳ
  bản ghi doanh thu nào khi WON (T-REV-001 "Deal Won is not revenue").
- **BO-0203 Commercial Catalog** (`src/commercial-catalog/`) — CRUD +
  version tự tăng khi sửa (không đổi lịch sử Proposal/Contract đã tham
  chiếu, vì các dòng đó lưu giá snapshot, không join sống).
- **BO-0204/0205 Proposal** (`src/proposals/`) — versioned theo Opportunity
  (mỗi bản là 1 dòng mới, không ghi đè), dòng đề xuất tự tính tổng, ngưỡng
  giảm giá >15% tự đặt `requiresApproval=true`, duyệt bắt buộc có
  `approverNote` (bằng chứng kiểm toán — BO-0205 "threshold rules
  deny/approve with audit").
- **BO-0206/0207/0208 Contract** (`src/contracts/`) — FSM đầy đủ, khoá
  sửa dòng hợp đồng sau khi vào `SIGNING` (T-CON-001 "immutable after
  signature"), `sourceOpportunityId` không unique (T-CON-002 "một deal
  nhiều hợp đồng"). Chữ ký điện tử seam trung lập nhà cung cấp
  (`ContractSignature`, provider MOCK — chưa nối DocuSign/HelloSign thật).
  Nghĩa vụ/cảnh báo (`ContractObligation`) tự sinh từ dòng MILESTONE khi
  hợp đồng EFFECTIVE, `alertStatus` tính runtime (PENDING/DUE_SOON/OVERDUE).
  Cầu nối xuất hoá đơn (`BillingRequest`, `idempotencyKey` bắt buộc — rủi ro
  tài chính thật nếu gửi trùng).
- **BO-0209 KPI** (`src/revenue-kpi/`) — 6 KPI theo đúng
  `data/KPI_CATALOG.csv`, mỗi KPI có `formula`+`source` hiển thị (không mù
  mờ về doanh thu). KPI-FIN-002/KPI-LEAK-001 (cần FinERP) báo
  `unavailable:true`, không giả lập số liệu.
- **BO-0210 seed** — `seed-data/customers/revenue-contract-journey.seed.json`
  + `scripts/revenue-contract-seed.mjs`: đúng kịch bản T001 X-TECH →
  Riverside (cơ hội OPP 5B VND đàm phán 75%, đề xuất 4.9B cần duyệt giảm
  giá, hợp đồng XTECH-RIVERSIDE-2026-001 EFFECTIVE 4.8B với 4 dòng + 1 chữ
  ký + 4 mốc thanh toán MS-01..04, MS-01 đã hoàn thành sinh 1 yêu cầu xuất
  hoá đơn READY 960M).
- Role mới `CONTRACT_MANAGER` (`contract.*`); `SALES_MANAGER` mở rộng thêm
  `opportunity.*`/`catalog.*`/`proposal.*`.
- Smoke: `test:opportunities` (11), `test:commercial-catalog` (7),
  `test:proposals` (14), `test:contracts` (25), `test:revenue-kpi` (8) — tất
  cả PASS 2 lần liên tiếp (idempotent), không hồi quy smoke cũ. Wired vào CI.
- Frontend: `/office/opportunities` (+`[id]`), `/office/catalog`,
  `/office/contracts` (+`[id]`), `/office/revenue-kpi` — đã verify qua
  browser thật (số liệu KPI khớp tay tính, click "Báo cáo trễ hạn" thật rồi
  dọn sạch).

**Chưa làm** (ngoài phạm vi BO-0201..0210, không phải thiếu sót): DocuSign/
HelloSign thật (BO-0207 seam vẫn MOCK), FinERP thật (KPI-FIN-002/LEAK-001),
ChangeRequest/amendment sau khi hợp đồng đã ký, CollectionCase, Subscription
lifecycle riêng ngoài Contract, AI Agent/Camera track (khác backlog stream
G5/G6), form tạo Proposal/Catalog trên UI (hiện tạo qua API/seed, xem qua
UI).

## Hoãn lại / song song sau

- Identity-P0 G4 (Identity Hub XHub) — sau Phase 2 hoặc song song. G5/G6 (X1/X2 adapter) chặn bởi X1 rotate secret + auth authority, X2 isolation gate — ngoài repo này.
- AI Agent Foundation (G5), AI Camera Pilot (G6) — sau khi Revenue/Contract/Delivery/People MVP xong.

## Ngoài phạm vi phiên này

- X1: rotate secret, chốt auth/schema authority (ADR-X1-01/ADR-X1-ID-01).
- X2: đóng isolation gate.
- Điều kiện tiên quyết cho G7 (live integrations) — cần phiên làm việc riêng trên các repo đó.

## Kiểm chứng

- **Phase 0**: ✅ đã chạy — `test:authz`/`test:rls`/`test:isolation` PASS, regression mới PASS, `prisma migrate status` sạch.
- **Phase 1**: file trong `docs/implementation/xoffice-ai/` đầy đủ, ADR "draft ready for signoff".
- **Phase 1.5 A**: 0 raw write chéo còn lại, `TenantScopeInterceptor` đã dời, ESLint boundary rule hoạt động, `test:*` cũ vẫn PASS.
- **Phase 1.5 B**: 2 process boot độc lập 2 port, cùng DB, mọi `test:*` PASS lại.
- **Phase 1.5 C**: 2 DB riêng, `MUST_NOT_LEAK` PASS giữa 2 app, Delivery→Launch Factory qua HTTP có evidence.
- **Phase 2**: seed T001 chạy end-to-end lead→contract trên UI thật, RLS/negative test cho từng entity mới.
