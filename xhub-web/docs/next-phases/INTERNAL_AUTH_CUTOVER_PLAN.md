# INTERNAL_AUTH_CUTOVER_PLAN

Kế hoạch đưa xác thực **NỘI BỘ** (INTERNAL auth) lên mức production-grade trên
**staging** cho X-TECH Internal Pilot — **KHÔNG** dùng Keycloak/Azure AD live.

- Phạm vi: PH-00 (Baseline & Internal Auth), backlog **NX-001..NX-004**.
- Tài liệu này chỉ mô tả kế hoạch (docs-first, no code).
- Tài liệu anh em cần đọc kèm: `CURRENT_RELEASE_DELTA_ANALYSIS.md`,
  `PHASE_EXECUTION_PLAN.md`, `SEED_MIGRATION_PLAN.md`.
- Căn cứ mã nguồn: `xhub-api/src/auth/*`, `xhub-api/SECURITY.md`,
  `xhub-api/.env.example`. Căn cứ handoff:
  `XTECH_XHUB_NEXT_PHASES_COMPACT_UX_SEED_HANDOFF_20260730/` (CLAUDE.md,
  docs/00, docs/01, docs/04, backlog/IMPLEMENTATION_BACKLOG.csv).

> Non-negotiable đang áp dụng (CLAUDE.md handoff): (1) INTERNAL auth cho pilot,
> (2) không Keycloak/Azure live, (6) không mật khẩu plaintext trong seed,
> (7) không gửi email thật cho tài khoản `.local`, (8) không demo fallback ở
> vùng staging đã hoàn tất, (12) giữ `demo-isolation` + `MUST_NOT_LEAK`.

---

## (a) Năng lực auth hiện có vs delta cần làm

### Đã có trong mã nguồn (đã verify)

| Năng lực | Vị trí | Ghi chú |
| --- | --- | --- |
| Session cookie `xhub_session` (JWT, httpOnly, 8h) | `auth.controller.ts` `setCookie`, `identity.types.ts` `SESSION_COOKIE` | `secure:false` hiện tại (dev over http) — **cần bật true sau TLS** |
| `IdentityGuard` soft: session → header → default | `identity.guard.ts`, `auth.service.ts` `resolveIdentity` | Không bao giờ chặn; chỉ resolve WHO |
| `PermissionGuard` env-gated | `permission.guard.ts` | Chỉ tác động route gắn `@RequirePermission`; anonymous → 401, thiếu quyền (khi enforce) → 403 |
| Cờ `AUTH_ENFORCE` (default false) | `identity.types.ts` `isEnforcing` | Header test-only `x-authz-enforce` chỉ làm **chặt hơn** |
| Cờ `AUTH_ALLOW_HEADER_IDENTITY` (default true) | `identity.types.ts` `allowHeaderIdentity` | Header test-only `x-authz-allow-header:false` |
| `MockOidcProvider` + `/api/auth/oidc/login\|callback` | `auth.controller.ts`, `oidc/mock-oidc.provider.ts` | Gated bởi `AUTH_OIDC_ENABLED` (default false → 503); **seam, không phải IdP thật** |
| `POST /api/auth/login` (passwordless, validate theo Membership) | `auth.service.ts` `login` | Nhận `email` hoặc `userId`; **không mint identity cho id lạ** |
| `POST /api/auth/logout` | `auth.controller.ts` | `clearCookie` |
| `GET /api/auth/me` | `auth.controller.ts`, `auth.service.ts` `me` | Trả `source` (session/header/default/anonymous) |
| `POST /api/auth/switch-tenant` | `auth.controller.ts`, `auth.service.ts` `switchTenant` | Chỉ đổi được nếu có Membership active ở tenant đó |
| Membership plane (cross-tenant, `withBypass`) | `auth.service.ts` `membershipsFor`, `prisma.service.ts` | Model `Membership` (schema.prisma:335) |
| FE login | `xhub-web/src/app/(auth)/login/{page,LoginForm}.tsx` + `api/auth/{login,logout}/route.ts` | **Chưa có** trang invite/reset/select-tenant |

### Thiếu cho pilot (delta → backlog)

| Delta | Backlog | Hiện trạng mã | Ghi chú |
| --- | --- | --- | --- |
| Invite activation (kích hoạt bằng invite link) | **NX-002** | **Thiếu hoàn toàn** — chưa có endpoint/model token | Seed dùng `activationMode = INVITE_LINK` cho 22/24 account (xem SEED_MIGRATION_PLAN §c) |
| Forgot/reset (đặt lại truy cập không mật khẩu plaintext) | **NX-002** | **Thiếu** | `.local` account → không gửi mail thật |
| Select-tenant (UI chọn tenant khi login) | **NX-002** | Backend `switch-tenant` **đã có**; **thiếu FE** | Chỉ cần trang FE gọi endpoint sẵn có |
| Session revoke on suspend/role-change | **NX-003** | **Thiếu** — JWT hiện self-contained, không kiểm tra trạng thái sau khi phát | Cần cơ chế "kiểm tra Membership.status tại mỗi request" hoặc session store (xem §c) |
| Auth pages Tailux polish (responsive/light-dark/error) | **NX-004** | Chỉ có LoginForm cơ bản | Trang login/invite/reset/select-tenant |
| Rotate `ANTHROPIC_API_KEY` + baseline tag | **NX-001** | Cảnh báo trong `SECURITY.md` (fingerprint `d9d24a2d90654ea4` đã lộ) | **Phải do người** thực hiện (xem §c cutover) |
| Staging cutover `AUTH_ENFORCE=true` + `AUTH_ALLOW_HEADER_IDENTITY=false` | **NX-002** acceptance | Cờ đã có, mặc định demo-safe | Xem checklist §c |

> Gap handoff-vs-code cần nêu rõ: handoff NX-002 gọi là "Internal
> login/forgot/reset/select tenant" nhưng **mã hiện chỉ có login + switch-tenant
> backend**. Ba mảnh forgot/reset/invite là mã MỚI hoàn toàn; select-tenant chỉ
> thiếu lớp FE.

---

## (b) Thiết kế token/flow cho INVITE + RESET (không plaintext, không email thật)

### Ràng buộc bất biến (SECURITY.md + CLAUDE.md handoff)

- **Không lưu mật khẩu/secret trong DB** (SECURITY.md "Secrets policy hard
  invariant"). Auth delegate cho IdP; identity rows không mang secret.
- Tài khoản seed đều `password: null` (accounts.seed.json) — flow invite/reset
  **không** tạo cột password mới trong DB. Nếu pilot cần "đặt mật khẩu nội bộ",
  chỉ lưu **hash** (argon2/bcrypt) trong một bảng credential tách biệt — vẫn
  **không bao giờ** là plaintext, và phải được `scan:secrets` bỏ qua đúng cách.
  Khuyến nghị pilot: giữ passwordless (magic-link nội bộ) để không đụng invariant.
- **Không gửi email thật** cho `.local`. Token phải **surface in-app/admin**,
  không đi qua kênh mail bên ngoài.

### Quy tắc "no real email delivery" (bắt buộc ghi vào runbook)

> Mọi email seed thuộc domain `.local` (`*.xtech.local`,
> `must.not.leak@demo-isolation.local`). Hệ thống **KHÔNG** cấu hình SMTP/transport
> gửi ra ngoài trên staging. Token invite/reset được **hiển thị trực tiếp** cho
> Tenant Admin trong màn quản trị (hoặc trả trong response API admin), người quản
> trị copy link đưa cho người dùng nội bộ. Đây là quyết định có chủ đích cho
> Internal Pilot, không phải thiếu sót.

### Token model (đề xuất — thiết kế, chưa code)

Một bảng `AuthActivationToken` (tenant-scoped, thêm vào `rls-setup.mjs` +
`rls-test.mjs` như mọi bảng identity — theo chú thích schema.prisma:352):

| Trường | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | uuid | |
| `tenantId` | string | RLS scope |
| `personId`/`userId` | string | trỏ tới PersonProfile/seed user |
| `purpose` | enum | `INVITE` \| `RESET` |
| `tokenHash` | string | **chỉ lưu hash** của token (SHA-256); token thô chỉ tồn tại ở thời điểm phát, surface cho admin |
| `expiresAt` | datetime | invite dài (vd 7 ngày), reset ngắn (vd 1 giờ) |
| `consumedAt` | datetime? | single-use — set khi kích hoạt xong |
| `createdBy` | string | admin phát token (audit) |

Nguyên tắc:
- **Token thô không lưu DB** — chỉ lưu `tokenHash`. Giống mẫu WEBHOOK secret
  (SECURITY.md: chỉ lưu kết quả verify, không lưu secret).
- **Single-use + hết hạn**: `consumedAt` != null hoặc quá `expiresAt` → vô hiệu.
- **Idempotent phát lại**: phát token mới cho một person sẽ **thu hồi** token
  `INVITE`/`RESET` chưa dùng của người đó (tránh nhiều link sống song song) —
  khớp acceptance NX-010 "Idempotent invite + audit".

### Flow

**INVITE (account `INVITE_LINK`, `status ACTIVE`, `mustChangePassword true`):**
1. Admin (hoặc bước seed activation) gọi API phát invite → tạo token `INVITE`,
   trả link `/(auth)/invite?token=…` **surface in-app cho admin** (không mail).
2. Người dùng mở link → FE gọi verify token → nếu hợp lệ, cho phép "kích hoạt".
3. Kích hoạt: đặt trạng thái person = active/đã-onboard, `consumedAt`=now, ghi
   `AuditLog`. **Không** ghi mật khẩu plaintext. Sau đó phát `xhub_session` cookie
   như login thường (tái dùng `AuthService.login` → cùng downstream).

**RESET (forgot):**
1. Người dùng ở trang `/(auth)/forgot` nhập email `.local` → API tạo token
   `RESET` (nếu person tồn tại & active) → surface cho admin (không mail).
   Trả response **không tiết lộ** email có tồn tại hay không (chống enumeration).
2. Link `/(auth)/reset?token=…` → verify → cho đặt lại truy cập → `consumedAt`,
   `AuditLog`, phát session mới.

**SELECT-TENANT:** sau login, nếu `memberships.length > 1` → FE hiện danh sách,
gọi `POST /api/auth/switch-tenant` (đã có). Account seed hiện đều 1 tenant
(`tenant-xtech`) nên đây là màn phòng hờ + dùng cho admin đa tenant.

> `demo-isolation` (`usr-demo-isolation`, `activationMode NO_LOGIN_IN_XTECH`):
> **KHÔNG** phát invite/reset token; mọi endpoint auth phải từ chối person này
> trong tenant `tenant-xtech`. Đây là chốt kiểm tra isolation (giữ NON-negotiable
> 12).

---

## (c) Staging cutover checklist

Thứ tự bắt buộc, mỗi bước có bằng chứng (evidence) đính kèm release note.

1. **[NGƯỜI] Rotate `ANTHROPIC_API_KEY` (NX-001).**
   - Theo `SECURITY.md` §"API key rotation": tạo key mới tại
     `https://console.anthropic.com/settings/keys`, **revoke key cũ** (fingerprint
     đã lộ `d9d24a2d90654ea4`), cập nhật `.env` deploy (không commit).
   - Chạy `npm run scan:secrets` → PASS (key chỉ ở `.env`). Restart server, xác
     nhận **không** còn cảnh báo `[SECURITY]` ở boot (main.ts fingerprint guard).
   - **Không thể tự động hóa** — con người thực hiện.

2. **Đặt secret session thật.** `AUTH_JWT_SECRET` hiện để trống trong
   `.env.example` → sinh giá trị random mạnh cho staging (nếu rỗng, JWT ký bằng
   mặc định yếu — rủi ro). Đây là điều kiện tiên quyết cho enforcement.

3. **Bật enforcement + tắt header identity.**
   - `AUTH_ENFORCE=true`
   - `AUTH_ALLOW_HEADER_IDENTITY=false`
   - (`AUTH_OIDC_ENABLED` giữ `false` — pilot dùng INTERNAL, không IdP live.)
   - Kết quả kỳ vọng: request không session hợp lệ → route `@RequirePermission`
     trả **401** (anonymous); caller thiếu quyền → **403**.

4. **Bật cookie secure sau TLS.** `setCookie` trong `auth.controller.ts` đang
   `secure:false`. Sau khi staging chạy HTTPS, đổi thành `secure:true`
   (và cân nhắc `sameSite` phù hợp) — nếu không cookie bị chặn/không an toàn.

5. **Verify không route nghiệp vụ nào dùng demo/header identity.**
   - Rà `resolveIdentity`: với `AUTH_ALLOW_HEADER_IDENTITY=false` + không session
     → source `anonymous`. Kiểm tra **mọi module** (`xoffice`, `records`,
     `controlplane`, `backup`, `mdm`, `identity`) không còn đường phụ thuộc
     `x-user-id`/`x-tenant-id` hay default persona `user-nam`/`tenant-xtech`.
   - Chú ý: nhiều **script seed/smoke** (vd `records-seed.mjs` gửi header
     `x-tenant-id/x-user-id`) sẽ **fail khi header off** — đây là hành vi đúng;
     seed phải chạy **trước** cutover hoặc qua đường server-side có session/bypass
     (xem SEED_MIGRATION_PLAN §b).
   - Non-negotiable 8 handoff: "No demo fallback in completed staging areas".

6. **Verify session revoke (NX-003).** Suspend một Membership
   (`status=suspended`) hoặc đổi role → phiên đang mở của người đó phải **mất
   hiệu lực** ở request kế tiếp. Vì JWT hiện self-contained, cần một trong hai:
   - **Kiểm tra tại request**: `PermissionGuard`/`IdentityGuard` tra
     `Membership.status` (đã đọc dưới `withBypass`) và từ chối nếu `suspended`; hoặc
   - **Session store/denylist**: lưu jti bị thu hồi.
   Bằng chứng: script suspend → gọi `/api/auth/me` hoặc route bảo vệ → nhận 401/403.

7. **Verify demo-isolation.** `usr-demo-isolation` không login được vào
   `tenant-xtech`; `MUST_NOT_LEAK` không rò qua bất kỳ collection nào
   (`SeedService.assertScope` đã throw nếu phát hiện — giữ nguyên).

8. **Gắn baseline tag** sau khi các bước trên PASS (NX-001 acceptance: baseline
   tag + old key revoked).

---

## (d) Test plan + rollback

### Mở rộng `test:authz` (`scripts/authz-smoke.mjs`)

Bộ hiện có (theo SECURITY.md) đã chứng minh: admin ALLOWED (2xx), low-priv
DENIED (403), anonymous → 401, mock OIDC round-trip → session, tất cả trên
**một** server `:4000` với enforcement OFF nhờ header test-only. Bổ sung:

| Test mới | Kỳ vọng |
| --- | --- |
| Login đúng identifier (email `.local` / userId) | 200 + set cookie `xhub_session` |
| Login id lạ | 401 (`login` không mint identity) |
| Invite: phát token → verify → activate → session | 200, token single-use (dùng lại → 4xx) |
| Reset: forgot (không lộ tồn tại email) → reset → session | 200, token hết hạn → 4xx |
| Select-tenant: user 1 tenant / đa tenant | switch-tenant chỉ pass khi có Membership active |
| Session revoke: suspend Membership → request kế tiếp | 401/403 |
| Isolation: `usr-demo-isolation` login `tenant-xtech` | từ chối; `MUST_NOT_LEAK` không xuất hiện |
| Header-off: `x-authz-allow-header:false` + không session trên route bảo vệ | 401 |

Tận dụng header test-only (`x-authz-enforce`, `x-authz-allow-header`,
`x-authz-oidc`) để test enforcement **không cần** restart server — mẫu đã có.
Kết hợp `test:isolation` sẵn có để chốt `MUST_NOT_LEAK`.

### Rollback

- Cutover chỉ là **đổi ENV** (`AUTH_ENFORCE`, `AUTH_ALLOW_HEADER_IDENTITY`,
  `secure`) — rollback = đặt lại `AUTH_ENFORCE=false` /
  `AUTH_ALLOW_HEADER_IDENTITY=true` và restart. Cờ được thiết kế additive,
  default demo-safe (identity.types.ts), nên hoàn nguyên không phá dữ liệu.
- Token invite/reset: nếu lỗi, thu hồi hàng loạt (set `consumedAt`) — không ảnh
  hưởng identity rows (không lưu secret).
- Key rotation **không** rollback (key cũ đã revoke); nếu cần, phát key mới lần
  nữa. Baseline tag cho phép quay lại điểm trước cutover.
- Ghi rõ trong release note: điều kiện PASS, ai ký, cách hoàn nguyên (theo
  nguyên tắc handoff docs/00: mỗi phase có release note + rollback).
