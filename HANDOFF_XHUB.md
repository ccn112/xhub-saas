# HANDOFF — XHub / X.Space / X.Office (cập nhật kế hoạch)

> 🖥️ **CHUYỂN MÁY?** Đọc [MACHINE_HANDOFF_RUNBOOK.md](MACHINE_HANDOFF_RUNBOOK.md) trước — DB Postgres + server là local (không sync qua Drive), phải dựng lại + seed.


> Doc đầu mối bàn giao. Cập nhật: 2026-07-30. Tenant: X-TECH (001).
> Đọc kèm: [PROJECT_STATUS_XHUB.md](PROJECT_STATUS_XHUB.md) (chi tiết tiến độ) · [Developer Guide](xhub-web/docs/DEVELOPER_GUIDE.md) · [User Guide](xhub-web/docs/USER_GUIDE.md) · [SECURITY.md](xhub-api/SECURITY.md).

## 1. Sản phẩm & repo
- **xhub-web** (`D:\Code\xhub-web`) — Next.js 16 App Router + Tailwind v4, design system **Tailux** (mua). FE **không đụng DB** — mọi dữ liệu qua BFF. Dev `:3000`.
- **xhub-api** (`D:\Code\xhub-api`) — NestJS + Prisma 7 (adapter-pg) + PostgreSQL. Ranh giới DB duy nhất. `:4000`.
- **xhub** (`D:\Code\xhub`) — repo nghiên cứu/ADR/contracts.
- Chạy: `xhub-web> npm run dev` · `xhub-api> npm run build && node dist/src/main.js` (KHÔNG dùng `start:prod` — trỏ sai `dist/main`, đúng là `dist/src/main.js`). Cần Postgres + `.env`.

## 2. Trạng thái — nền tảng ĐÃ XONG (verify xanh)
| # | Hạng mục | Trạng thái |
|---|---|---|
| 1 | Auth session/JWT + Membership | ✅ |
| 2 | Postgres RLS per-tenant (`withTenant/withBypass`, FORCE) — **35 bảng** | ✅ |
| 3 | Identity/Org Core (PersonProfile UUID/OrgUnit/Position/RoleBinding/DataScope + resolver + RBAC/ABAC) | ✅ |
| 4 | Control Plane + Provisioning (outbox idempotent/conflict/retry/reconcile) | ✅ |
| 5 | Shared MDM + ingestion (MasterRecord/overlay, dedup no-auto-merge) | ✅ |
| 6 | Backup/restore per-tenant (manifest+checksum+watermark, AES-256-GCM, sandbox/dry-run + remap, MUST_NOT_LEAK) | ✅ |
| 7 | Tenant Admin UI — **15/15 màn** `/admin/*` | ✅ |
| 8 | Records/document + object storage · Webhook inbound + transactional outbox + reconcile · Condition AST · secret-scan | ✅ |
| + | Nav IA: icon rail gom **5 workspace cha** (home/work/space/office/business) | ✅ |
| + | FE Admin **wire live** `/api/identity`+`/api/controlplane`+`/api/backup` (degrade demo) + write-flow (tạo backup/restore/enable/bind/retry/reconcile) + form kit Tailux | ✅ |
| + | Documents **hợp nhất** `/api/records` (list enrich, version history, upload/phiên-bản-mới) | ✅ |
| + | Authz enforcement **env-gated** (`@RequirePermission`+`PermissionGuard`) + OIDC seam (mock) | ✅ |

**Verify gate (server sạch, đơn :4000, tsc 0):** `test:rls` (35 bảng) · `test:smoke` (13 workflow E2E) · `test:controlplane` · `test:mdm` · `test:backup` · `test:records` · `test:webhook` · `test:condition` · `test:authz` (allow/deny/401/oidc) · `scan:secrets` — **tất cả PASS**. FE tsc 0 lỗi `src/**`.

## 3. Cấu hình môi trường (bảo mật)
| Env | Demo | Production |
|---|---|---|
| `AUTH_ENFORCE` | `false` (no-op) | **`true`** (403 khi thiếu quyền) |
| `AUTH_ALLOW_HEADER_IDENTITY` | `true` (smoke/dev) | **`false`** (401 nếu không session) |
| `AUTH_OIDC_ENABLED` + `AUTH_OIDC_*` | `false` (mock) | bật khi nối Azure AD |
| `BACKUP_ENCRYPTION_KEY` / `WEBHOOK_SIGNING_SECRET` | có sẵn dev | đặt secret thật qua env |

## 4. 🔴 Việc CHỦ DỰ ÁN phải làm (không agent làm thay)
1. **Rotate `ANTHROPIC_API_KEY`** trong `xhub-api/.env` (fingerprint `d9d24a2d90654ea4`, đã lộ) tại https://console.anthropic.com/settings/keys — tạo mới, revoke cũ, thay qua env. (`scan:secrets` + cảnh báo boot đã có; thu hồi là thao tác người.)
2. Cấp **credential/endpoint hệ thống ngoài** khi muốn nối thật: IdP Azure AD (OIDC) + connector FinERP(Frappe)/Mattermost/X2-BMS — hiện là mock/seam.

## 5. Kế hoạch tiếp theo (đề xuất ưu tiên)
- **P1 · Nối IdP Azure AD thật** vào OIDC seam đã sẵn (`OidcProvider` + `MockOidcProvider` → drop-in provider thật), bật `AUTH_ENFORCE=true` + `AUTH_ALLOW_HEADER_IDENTITY=false`, kiểm regression bằng `test:authz`. *Cần: issuer/clientId/secret.*
- **P1 · Nối connector thật** (FinERP Material/Payment Request, Frappe HR, Mattermost) thay mock adapter, qua transactional outbox + webhook inbound đã có; nối AI live ổn định. *Cần: endpoint + sandbox.*
- **P2 · Bổ sung endpoint identity còn thiếu** để 3 màn admin demo lên live: invitations (mời user), role-bindings (ghi), delegations (ghi) — FE FormDrawer đã dựng sẵn, chỉ chờ endpoint.
- **P2 · Dọn nợ UI**: thống nhất `ChannelShell` vs `_components/ChannelHeader` (màn Space — rủi ro trung bình, test kỹ); a11y audit sâu; visual regression.
- **P3 · Backup vận hành**: schedule/retention job + luồng duyệt khôi phục production.

## 6. Nợ kỹ thuật / lưu ý vận hành
- Connector/AI còn mock; authz enforcement off ở demo (env-gated).
- `Document` (seed FE, dùng cho panel liên quan ở màn khác) song song `RecordDocument` (backend, màn /documents) — chưa hợp nhất hoàn toàn seed cũ.
- Giữ **1 server/cổng**; nhiều bản dev server trùng gây 500.
- Bất biến bắt buộc: no fake ERP objects · no secret trong DB/backup · email không phải key · no dual-write · version immutable · AI draft-first + human confirm · tenant isolation.

## 7. Tài liệu
> **Xem ngay trong app:** rail → **Doanh nghiệp** → nhóm **"Tài liệu & Kiểm thử"** → `/docs` (Tổng quan · Phát triển · Hướng dẫn sử dụng · **Kiểm thử tương tác** bot‑test + user tick). Render trực tiếp từ các file `.md` bên dưới (react-markdown), không nhân bản nội dung.

- [PROJECT_STATUS_XHUB.md](PROJECT_STATUS_XHUB.md) — tiến độ chi tiết + backlog.
- [xhub-web/docs/DEVELOPER_GUIDE.md](xhub-web/docs/DEVELOPER_GUIDE.md) — kiến trúc, design system Tailux + catalog component, cách thêm màn/form, BFF/RLS/auth, test gate.
- [xhub-web/docs/USER_GUIDE.md](xhub-web/docs/USER_GUIDE.md) — hướng dẫn người dùng cuối (5 workspace + tác vụ theo bước).
- [xhub-api/SECURITY.md](xhub-api/SECURITY.md) — quy trình rotate key, secret scanning, cấu hình auth production.
- Gap-analysis / implementation-plan: `xhub-web/*_GAP_ANALYSIS.md`, `*_IMPLEMENTATION_PLAN*.md`; ADR ở `xhub/docs/architecture`.
