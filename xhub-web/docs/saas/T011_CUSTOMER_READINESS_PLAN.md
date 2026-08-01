# T011_CUSTOMER_READINESS_PLAN — Cổng sẵn sàng khách hàng trả phí đầu tiên

> Docs-first, KHÔNG code. Nguồn: handoff `docs/08_CUSTOMER_TENANT_011_PLUS.md`,
> `docs/09_PLATFORM_MENU_AND_SECURITY.md`, `docs/04`, `docs/10`,
> `config/subscription-plans.example.json`, `data/TENANT_NUMBERING_POLICY.csv`,
> `tests/TEST_SCENARIOS.csv`, `backlog/IMPLEMENTATION_BACKLOG.csv` (E7 + E8).
> Chị em: `TENANT_REGISTRY_IMPLEMENTATION_PLAN`, `TENANT_LAUNCH_FACTORY_PLAN`,
> `BLUEPRINT_SEED_PACK_PLAN`, `PLATFORM_VS_TENANT_PERMISSION_PLAN`, `T002_REAL_ESTATE_DEMO_PLAN`.

## 1. Mục tiêu

T011 là **khách hàng thuê bao đầu tiên** (không dùng cho demo — `docs/08`). Tài liệu định nghĩa
**cổng sẵn sàng thương mại (commercial readiness gate)**: tập điều kiện thoát (exit criteria) phải
đạt để onboard một khách hàng thật **an toàn**. Khách hàng khác demo ở chỗ có billing/hợp đồng,
cấp phát tenantNo động, và ràng buộc pháp lý/offboarding.

## 2. Phân bổ tenantNo ≥ 11 trong lock (non-negotiable #2, #5)

- Khách hàng **bắt đầu tại T011** (`docs/08`, TC-003); T001 cố định X-TECH, T002–T010 reserved
  demo (`subscription-plans.example.json`: `reservedTenantNos` 1 và 2–10).
- **Allocator** cấp số ≥ 11 **trong một lock** (SAAS-034) để tránh race → không hai khách cùng
  nhận một số; **tenantNo immutable + không tái sử dụng số đã đóng** (TC-004, non-negotiable #2).
- Test tenant hệ thống **không tiêu** số thương mại (CLAUDE.md handoff).
- Cơ chế allocator + state machine ở `TENANT_REGISTRY_IMPLEMENTATION_PLAN` (SAAS-032/033/034);
  cổng này chỉ yêu cầu nó PASS TC-003/TC-004.

## 3. Onboarding self / assisted (docs/08)

Yêu cầu onboarding khách (`docs/08`) — mọi mục là điều kiện cổng:
- Approved commercial reference (hợp đồng đã duyệt) → là input hợp lệ cho Launch Factory.
- Immutable tenant number (§2).
- Plan + entitlement (§4).
- Blueprint + seed selection (`BLUEPRINT_SEED_PACK_PLAN`).
- First Tenant Admin (invite, no plaintext — TC-011).
- Domain/branding.
- Backup policy.
- Readiness / UAT / handover.
- Support + customer success owner.
- Offboarding / export / retention policy (§6).

Cả **self-service** lẫn **assisted** (do Delivery Workspace T001 dẫn) đều đi qua **cùng Launch
Factory** như T002 (`docs/04`) — chỉ khác nguồn trigger + có bước hợp đồng/billing. Flow đầy đủ
"approved contract → handover" là TC-019 (SAAS-070).

## 4. Enforcement plan/entitlement (subscription-plans.example.json)

Ba bậc khách: `STARTER` (50 user / 20GB / xhub+xoffice), `PROFESSIONAL` (300 / 200GB /
+xspace+xai), `ENTERPRISE` (5000 / 2000GB / +shared-mdm+advanced-backup). Cả ba có
`customerTenantMinNo=11` → **chặn gán plan khách cho tenant ≤10** (bảo vệ TC-002/TC-003).

Cổng yêu cầu **enforce thật**, không chỉ hiển thị:
- Entitlement app: tenant chỉ thấy/dùng app theo plan (TC-014/015).
- Quota: user/storage theo `limits` (usage/quota dashboard — SAAS-081, E8).
- Billing gating: chỉ plan khách `billingEnabled`; demo/design-partner `false`.

## 5. Bảo đảm isolation + backup (cổng an toàn dữ liệu khách)

- **Cross-tenant isolation PASS** với khách mới (TC-005/006) — nền RLS `(tenantId,...)` đã có
  (~50 bảng, verify `schema.prisma`); khách T011 vào isolation matrix.
- **Backup/restore riêng** (non-negotiable #11, TC-016/017): backup khách không chứa tenant khác;
  restore giữ tenantNo/code. Module `backup/` đã có.
- **Platform operator không mặc định đọc business data khách** (non-negotiable #7, TC-007,
  `docs/09`) — đây là điều kiện pháp lý-thương mại của cổng.

## 6. Offboarding / export / retention (E7 SAAS-072)

- Export dữ liệu khách **không làm mất audit** (TC-020).
- Retention policy + xoá theo hợp đồng; **xoá vĩnh viễn là hành động có kiểm soát** (impact
  preview mọi action lifecycle — `docs/09`).
- Chính sách này phải tồn tại **trước** khi onboard (không để nợ sau go-live).

## 7. Support / audit / platform operations (E8)

Checklist vận hành nền tảng cho v1.0 (`docs/09`, `docs/10`, E8):
- **Support access** vào tenant khách: **time-bound + approved + audited** (TC-023, SAAS-083).
- **Platform health** không lộ business content (TC-021, SAAS-080).
- **Usage/quota** dashboard (SAAS-081).
- **Release rollout theo wave**, dừng/rollback theo tenant (TC-022, SAAS-082).
- **Audit** đầy đủ (AuditLog đã có trong schema) cho mọi action lifecycle + support access.
- **Platform Console tách quyền** khỏi Tenant Admin (non-negotiable #6; SAAS-004;
  `PLATFORM_VS_TENANT_PERMISSION_PLAN`).

## 8. Exit criteria (điều kiện làm onboard khách thật AN TOÀN)

Gộp `docs/10` (v1.0 SaaS) + TEST_SCENARIOS P0. Onboard T011 chỉ mở khi **tất cả** đạt:

1. Allocator cấp tenantNo=11 trong lock; immutable; không tái sử dụng (TC-003/004).
2. Plan/entitlement **enforce** (app + quota + billing) (TC-014/015).
3. Cross-tenant isolation PASS gồm T011 (TC-005/006/007).
4. Backup/restore riêng cho T011 + restore giữ tenantNo (TC-016/017).
5. First admin invite no plaintext; scan:secrets sạch (TC-011).
6. Onboarding flow approved-contract → handover chạy được (TC-019).
7. Offboarding/export giữ audit (TC-020).
8. Support access approved/expiry/audit; platform health không lộ business (TC-021/023).
9. Release rollout dừng/rollback theo tenant (TC-022).
10. Không hardcode X-TECH; Platform Console tách quyền (TC-024, non-negotiable #6).
→ Đạt = **v1.0 SaaS ready** (exit gate E8).

## 9. Gaps

- **Toàn bộ chuỗi E3–E8 chưa build**: registry/allocator/entitlement/launch factory/platform
  console chưa tồn tại trong code (`Tenant` model mới có `slug`+`name`). Cổng T011 phụ thuộc các
  plan chị em hoàn thành.
- **Billing/hợp đồng**: `subscription-plans.example.json` là ví dụ; tham chiếu hợp đồng/billing
  thật (SAAS-071, P1) chưa thiết kế — cần chốt trước khách trả phí.
- **Nợ hardcode xtech (5 chỗ)** phải dọn trước v1.0 (non-negotiable #1).
- **Connector/AI còn mock, authz enforcement env-gated off ở demo** (DEV_BACKLOG) → phải bật
  enforcement thật (STAGING_STRICT trở lên) trước khi onboard khách.
