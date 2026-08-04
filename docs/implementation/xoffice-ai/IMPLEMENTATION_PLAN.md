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

### Giai đoạn B — Tách process (2 NestJS app, vẫn 1 Postgres DB)
2 app riêng (module group riêng + package `identity`/`auth`/`prisma` dùng chung), vẫn 1 DB, `AUTH_JWT_SECRET` dùng chung (SSO không đổi).

### Giai đoạn C — Tách DB thật (đúng mục tiêu cuối)
X.Office có Postgres riêng; Tenant/Identity vẫn canonical ở XHub, X.Office lưu `AppAccountBinding`/`ExternalIdentity` local; Delivery→Launch Factory qua HTTP; AuditLog tách theo app; sự kiện xuyên hệ qua outbox/webhook thật.

### Giai đoạn D — Tách frontend + (tuỳ chọn) tách repo
Next.js multi-zone hoặc 2 domain riêng; session vẫn 1 JWT/OIDC issuer (XHub Identity Hub); tách repo Git là bước cuối cùng.

**Thứ tự khuyến nghị:** Giai đoạn A trước/song song đầu Phase 2 (tránh xây thêm nợ ranh giới). Giai đoạn B/C/D sau khi Phase 2 (Revenue & Contract MVP) chứng minh xong trên nền đã dọn sạch.

> **Lưu ý quan trọng — đối chiếu với quyết định trước đây:** `TINH_HINH_DU_AN_XHUB.md` mục 9, nhật ký 2026-08-02, có ghi: *"XOffice Standalone SaaS — xác nhận X.Office KHÔNG tách deploy, mãi mãi 1 codebase/1 sản phẩm"*. Đó là kết luận từ bộ handoff CŨ (`XTECH_XHUB_XOFFICE_STANDALONE_SAAS_HANDOFF_20260729`, dùng chữ "standalone" theo nghĩa "chạy được khi connector ngoài chưa nối", KHÔNG phải nghĩa "tách deployment vật lý"). Phase 1.5 ở đây là một **mục tiêu mới, khác nghĩa**, do chủ đầu tư trực tiếp chọn ngày 2026-08-03 (tách deploy/DB thật). Cần bạn xác nhận đây đúng là muốn đảo ngược/làm rõ so với ghi chú 2026-08-02, không phải hiểu nhầm của Claude.

## Phase 2 — Revenue & Contract MVP (G2, nhánh Business-Ops) — CHƯA BẮT ĐẦU

Theo `data/IMPLEMENTATION_BACKLOG.csv` mục `BO-0201..0210`, exit gate "T001 lead-to-contract": Customer/Contact + 360 view → Opportunity pipeline → Commercial Catalog → Proposal/Quotation → Discount/margin approval → Contract/Contract Line → e-signature seam → contract obligation/alert engine → pipeline/contract KPI → seed T001. Mỗi slice đạt Definition of Done (`docs/17_DEFINITION_OF_DONE.md`): migration + RLS/negative test + API/event/idempotency + UI thật + seed thật + audit/retention + observability + UAT.

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
