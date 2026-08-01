# MACHINE HANDOFF — Runbook dựng lại trên máy mới

> **Đọc file này đầu tiên khi mở dự án trên máy khác.**
> **XHub giờ là 1 git MONOREPO** tại `D:\Code` (branch `main`, track `xhub-api`+`xhub-web`+docs; `.gitignore` allowlist bỏ node_modules/.env/dist/.next/storage + dự án khác). Máy mới: `git clone <remote>` (hoặc sync Drive) → code về. **DB Postgres + server + `.env` là LOCAL — không theo git/Drive**, phải tạo lại `.env` + dựng DB + seed + chạy server (các mục dưới). Chưa có remote GitHub — thêm khi cần: `git remote add origin <url> && git push -u origin main`.
> Cập nhật: 2026-07-30. Mốc bàn giao: **PH-02 đóng + SaaS bước 1 (Tenant Registry) + bước 2 (Platform Console) — tất cả verified xanh.**

## 0. Trạng thái tại mốc bàn giao
- Nền tảng 8/8 · PH-00/01/02 đóng · SaaS step 1 (Tenant Registry) + step 2 (Platform Console + PLT_ namespace) xong.
- **RLS ~57 bảng**; ~23 `test:*` PASS; **không agent nào đang chạy** (an toàn chuyển máy).
- Repo: `D:\Code\xhub-saas\xhub-api` (NestJS :4000) · `D:\Code\xhub-web` (Next 16 :3000).

## 1. Prerequisites máy mới
- Node (v24 như máy cũ), PostgreSQL (bản 18), Git Bash/PowerShell.
- Postgres: tạo DB `xhub` + user `xhub` (password khớp `.env`).
- `xhub-api/.env` (KHÔNG sync — tạo lại): `DATABASE_URL="postgresql://xhub:<pass percent-encode>@localhost:5432/xhub?schema=public"` · `ANTHROPIC_API_KEY=...` (🔴 **rotate key mới** — key cũ đã lộ) · `XOFFICE_AI_MODEL=claude-haiku-4-5` · `XOFFICE_AI_LIVE=true` · `AUTH_JWT_SECRET=<đặt chuỗi>` · `BACKUP_ENCRYPTION_KEY=<base64 32B>` · `WEBHOOK_SIGNING_SECRET=<chuỗi>` · `DEFAULT_TENANT_ID=tenant-xtech` · `DEFAULT_USER_ID=user-nam`. (Xem `.env.example` để đủ biến.)
- `xhub-web/.env.local`: `XHUB_API_URL=http://localhost:4000` · `NEXT_PUBLIC_XHUB_API_URL=http://localhost:4000`.

## 2. Cài đặt
```bash
cd D:/Code/xhub-saas/xhub-api && npm ci
cd D:/Code/xhub-saas/xhub-web && npm ci
```

## 3. Dựng schema + RLS (trong xhub-api)
```bash
npx prisma db push --schema=prisma/schema.prisma   # KHÔNG dùng --accept-data-loss
npx prisma generate
node scripts/rls-setup.mjs                          # áp RLS policy (FORCE) cho mọi bảng tenant
```

## 4. Seed dữ liệu — THỨ TỰ QUAN TRỌNG
Khởi động api 1 lần để seed nền (IdentityService seed org/position/people khi boot), rồi chạy các seeder:
```bash
npm run build && node dist/src/main.js   # để boot seed nền, rồi Ctrl+C (hoặc để chạy luôn)
```
Sau khi api đã boot ít nhất 1 lần, chạy (api đang chạy):
```bash
npm run seed:roles            # 16 role registry (wildcard)
npm run seed:accounts         # 23 tài khoản + org units + role binding
npm run seed:person-avatars   # avatar + sđt
npm run seed:tenant-registry  # 10 tenant (T001=tenant-xtech ... T010)
npm run seed:platform-roles   # 10 role PLT_ (platform)
npm run seed:blueprint-catalog # 11 blueprint + 14 seed pack (versioned-immutable); áp SP-XTECH-OPS cho T001
npm run seed:records          # tài liệu
npm run seed:requests         # 42 request
npm run seed:directives       # 10 chỉ đạo
npm run seed:tickets          # catalog + 15 ticket
npm run seed:bookings         # 4 resource + 12 booking
npm run seed:announcements    # 6 thông báo + receipts
npm run seed:backup-schedules # lịch backup định kỳ + retention cho tenant ACTIVE (T001,T002); DAILY 02:00 VN / 35d-12w-12m
```
> Mọi seeder idempotent (skip-by-id/code) — chạy lại an toàn.

## 5. Chạy server
```bash
# API — CHỈ 1 instance trên :4000 (KHÔNG dùng start:prod — trỏ sai dist/main)
cd D:/Code/xhub-saas/xhub-api && node dist/src/main.js
# Provision T002 (BĐS demo) — SAU KHI server :4000 chạy + đã seed ở §4.
# Idempotent: reuse launch, không tạo trùng; T002 -> ACTIVE (tenantNo=2, VERTICAL_DEMO).
cd D:/Code/xhub-saas/xhub-api && npm run provision:t002
# Provision T003–T010 (8 vertical demo tenants) — 1 batch idempotent, SAU provision:t002.
# Reuse cùng Launch Factory + catalog + registry; skip tenant đã ACTIVE (không trùng);
# tự tạo backup schedule cho từng tenant mới. Resumable: chạy lại để hoàn tất phần còn lại.
cd D:/Code/xhub-saas/xhub-api && npm run provision:demos
# (tuỳ chọn) 1 tenant lẻ: npm run provision:tenant <tenantNo|key>  (vd: 8 | healthcare-demo)
# Web
cd D:/Code/xhub-saas/xhub-web && npm run dev            # :3000
```
> `provision:t002` chạy Launch Factory (BP-RE-002 + SP-RE-DEMO) tạo tenant T002 thật:
> org/users/apps(x1,x2)/dữ liệu demo + backup riêng + cô lập T001↔T002. In ra 2 user
> login-able (admin + employee, mật khẩu ENV `T002_ADMIN_PASSWORD`/`T002_EMP_PASSWORD`
> hoặc random mỗi lần — KHÔNG lưu repo). Đăng nhập với `x-tenant-id: tenant-realestate-demo`.
> `provision:demos` chạy CÙNG engine đã tổng quát hoá (`provision-tenant.mjs`, tham số từ
> `scripts/demo-tenants.params.mjs` — KHÔNG code branch/tenant) cho T003–T010: mỗi tenant
> 1 TenantLaunch (blueprint+seedpack theo catalog) → ACTIVE + backup schedule + 2 user
> login-able (`T00N_ADMIN_PASSWORD`/`T00N_EMP_PASSWORD` hoặc random). T008 y tế: CHỈ hành
> chính, KHÔNG bệnh án/PHI. Dữ liệu demo tổng hợp (`@demo.local`, `synthetic=true`).

## 6. Verify (nên chạy hết để chắc)
```bash
cd D:/Code/xhub-saas/xhub-api && npx tsc --noEmit       # 0 lỗi
# chạy lần lượt, tất cả PASS:
npm run test:rls && npm run test:smoke && npm run test:controlplane && npm run test:mdm && \
npm run test:backup && npm run test:records && npm run test:webhook && npm run test:condition && \
npm run test:authz && npm run test:roles && npm run test:auth-flow && npm run test:requests && \
npm run test:directives && npm run test:tickets && npm run test:bookings && npm run test:announcements && \
npm run test:tenant-registry && npm run test:platform-console && \
npm run test:launch-factory && npm run test:catalog && npm run test:delivery && \
npm run test:t002 && npm run test:backup-schedule && npm run test:demos && \
npm run test:readiness && npm run test:lifecycle && npm run scan:secrets
cd D:/Code/xhub-saas/xhub-web && npx tsc --noEmit        # 0 lỗi src/**
```

### Tenant Lifecycle (DEMO ↔ LIVE + reset-demo + go-live) — seed/backfill idempotent
```bash
cd D:/Code/xhub-saas/xhub-api
npm run seed:golive-template     # 1 template GOLIVE-GENERIC (shared, no-RLS)
npm run seed:tenant-registry     # backfill Tenant.mode: T001=null(exempt), T002–T010=DEMO (non-destructive)
npm run ensure:demo-baselines    # chụp DEMO_BASELINE bất biến cho T002–T010 (skip nếu đã có)
npm run test:lifecycle           # reset-demo + go-live + guards (self-cleaning throwaway tenant)
```
> Reset-demo: `POST /api/platform/tenants/:id/reset-demo` (chỉ DEMO, 409 nếu LIVE) — restore in-place từ DEMO_BASELINE.
> Go-Live: `GET/POST /api/platform/tenants/:id/go-live`, `PATCH .../go-live/steps/:key`, `POST .../go-live/activate` (clear demo + mode=LIVE, một chiều).
> UI: badge DEMO/LIVE ở `/platform/tenants` + detail; nút "Reset về demo" + `/platform/tenants/:id/go-live` (wizard).
> Lưu ý: `test:records`/`test:authz`/`test:t002` in "PASSED" rồi kèm 1 dòng assertion teardown libuv trên Windows — **KHÔNG phải lỗi** (đã biết).

## 7. Tài liệu tiếp tục
- [HANDOFF_XHUB.md](HANDOFF_XHUB.md) · [PROJECT_STATUS_XHUB.md](PROJECT_STATUS_XHUB.md) · [TINH_HINH_DU_AN_XHUB.md](TINH_HINH_DU_AN_XHUB.md) (cho ChatGPT).
- Kế hoạch SaaS: `xhub-web/docs/saas/*` (10 doc) — tiếp **bước 3 Launch Factory**.
- Backlog + thứ tự build SaaS: `xhub-web/docs/DEV_BACKLOG.md` (xem cũng ở /docs/backlog trong app).
- 🔴 **Việc người:** rotate `ANTHROPIC_API_KEY`.

## 8. Điểm tiếp theo (cho phiên máy mới)
SaaS **bước 3 — Launch Factory** (tái dùng outbox control-plane; `TenantLaunch` = chuỗi step idempotent register→org→enable app→blueprint→seed pack→backup→isolation→handover). Xem `xhub-web/docs/saas/TENANT_LAUNCH_FACTORY_PLAN.md`.
</content>
