# T003_T010_BATCH_PLAN — Batch-provision 8 demo vertical còn lại

> Docs-first, KHÔNG code. Nguồn: handoff `docs/04`, `docs/05`, `docs/07`, `docs/10`,
> `data/TENANT_CATALOG_001_010.csv`, `data/BLUEPRINT_CATALOG.csv`, `data/SEED_PACK_CATALOG.csv`,
> `config/subscription-plans.example.json`, `tests/TEST_SCENARIOS.csv`,
> `backlog/IMPLEMENTATION_BACKLOG.csv` (E6: SAAS-061/062/063/064).
> Chị em: `TENANT_LAUNCH_FACTORY_PLAN`, `BLUEPRINT_SEED_PACK_PLAN`,
> `TENANT_REGISTRY_IMPLEMENTATION_PLAN`, `T002_REAL_ESTATE_DEMO_PLAN`.

## 1. Nguyên tắc: MỘT batch lặp lại được, KHÔNG 8 bản xây riêng

T003–T010 dùng **chung một quy trình launch** (đã chứng minh ở T002) chạy theo **batch
idempotent** — chỉ khác **tham số** (tenantNo, blueprint, seed pack). Không có code branch riêng
cho từng tenant (non-negotiable, handoff `docs/05`: "T002–T010 không có code branch riêng"). Mỗi
lần chạy lại **không tạo tenant trùng** (TC-009). Đây là điểm phân biệt: đầu vào là **bảng tham
số**, không phải 8 dự án bespoke.

## 2. Bảng tham số batch (từ 3 catalog CSV)

| No | Code / Key | Ngành | Plan | Blueprint | Seed pack | Ràng buộc riêng |
|---|---|---|---|---|---|---|
| 3 | T003 / manufacturing-demo | Sản xuất | PROFESSIONAL_VERTICAL_DEMO | MANUFACTURING_ENTERPRISE (BP-MFG-003) | SP-MFG-DEMO | — |
| 4 | T004 / distribution-demo | Phân phối/Bán lẻ | PROFESSIONAL_VERTICAL_DEMO | DISTRIBUTION_RETAIL (BP-DIST-004) | SP-DIST-DEMO | — |
| 5 | T005 / construction-demo | Xây dựng | PROFESSIONAL_VERTICAL_DEMO | CONSTRUCTION_CONTRACTOR (BP-CONST-005) | SP-CONST-DEMO | — |
| 6 | T006 / hospitality-demo | Khách sạn/Dịch vụ | PROFESSIONAL_VERTICAL_DEMO | HOSPITALITY_SERVICES (BP-HOSP-006) | SP-HOSP-DEMO | — |
| 7 | T007 / education-demo | Giáo dục | PROFESSIONAL_VERTICAL_DEMO | EDUCATION_ORGANIZATION (BP-EDU-007) | SP-EDU-DEMO | — |
| 8 | T008 / healthcare-demo | Y tế hành chính | **ENTERPRISE_VERTICAL_DEMO** | HEALTHCARE_ADMINISTRATION (BP-HC-008) | SP-HC-DEMO | **KHÔNG bệnh án thật** (§5) |
| 9 | T009 / logistics-demo | Logistics/Vận tải | PROFESSIONAL_VERTICAL_DEMO | LOGISTICS_TRANSPORT (BP-LOG-009) | SP-LOG-DEMO | — |
| 10 | T010 / professional-services-demo | Dịch vụ chuyên nghiệp | PROFESSIONAL_VERTICAL_DEMO | PROFESSIONAL_SERVICES (BP-PS-010) | SP-PS-DEMO | — |

Tất cả tenantNo 3–10 nằm trong `reservedTenantNos` của plan `VERTICAL_DEMO`
(`subscription-plans.example.json`, `billingEnabled=false`, `apps=BY_BLUEPRINT`) → không cấp cho
khách. T008 dùng bậc ENTERPRISE (như T002) do phạm vi rộng hơn; còn lại PROFESSIONAL.

Mọi vertical pack **kế thừa Base Enterprise Pack** (SP-BASE-ORG/OFFICE/RECORDS/BACKUP) — quy tắc
`BLUEPRINT_SEED_PACK_PLAN`.

## 3. Chọn blueprint + seed theo tenant (không hardcode)

Launch Factory đọc **1 dòng tham số/tenant** từ bảng §2 (nguồn: registry + catalog), rồi chạy đúng
luồng `docs/04`. Blueprint/seed lookup theo ID (BP-xxx / SP-xxx), **không** if theo tenantKey. Các
gói phủ đúng phạm vi `BLUEPRINT_CATALOG.csv` (vd BP-MFG-003: purchase/maintenance/quality/asset/
inventory; BP-CONST-005: project/submittal/material/subcontractor/acceptance...). Việc bật app
theo `BY_BLUEPRINT` (TC-014/TC-015: tenant chỉ thấy app được cấp; vd T003 không thấy XBuilding).

Như T002, các vertical này **tái sử dụng primitive đã có** (requests/directives/tickets/bookings/
announcements + records + mdm + workflow) làm nền cho quy trình ngành; các module ngành chuyên sâu
chưa tồn tại được demo bằng primitive tương ứng (xem §7 Gaps).

## 4. Batch idempotent — trình tự thực thi (E6)

Theo `IMPLEMENTATION_BACKLOG.csv` E6, chia batch để giảm rủi ro:
- **SAAS-061**: batch T003–T005.
- **SAAS-062**: batch T006–T010.
- **SAAS-063**: cross-tenant isolation matrix (toàn bộ T001–T010).
- **SAAS-064**: per-tenant backup/restore drill.

Mỗi tenant, mỗi step **idempotent + retryable + audited + có evidence** (non-negotiable #8). Chạy
lại batch chỉ bổ sung tenant còn thiếu, không nhân bản (TC-009). Seed **dry-run trước apply**
(TC-013) cho từng tenant; published blueprint immutable (TC-012).

## 5. Ràng buộc healthcare (T008) — "không bệnh án thật"

`TENANT_CATALOG_001_010.csv` chốt T008: *"quản trị nội bộ, lịch trực, cấp quyền, tài sản và hồ sơ;
**không dùng bệnh án thật**"*. `BLUEPRINT_CATALOG.csv` BP-HC-008 phạm vi *Administration, shifts,
access, asset, records* — cố ý **hành chính, KHÔNG lâm sàng**. Ràng buộc seed SP-HC-DEMO:
- KHÔNG dữ liệu bệnh án/PHI thật; chỉ cơ sở/khoa/ca trực/tài sản demo (`SEED_PACK_CATALOG.csv`:
  facilities, departments, shifts, assets).
- Áp dụng chung: không plaintext secret (non-negotiable #10), không dữ liệu cá nhân thật.
- Đây là ranh giới sản phẩm, không phải cấu hình runtime → phải review ở acceptance.

## 6. Isolation + backup drill per-tenant (E6 SAAS-063/064)

- **Isolation matrix** (TC-006): mọi cặp trong T001–T010 deny chéo. Nền RLS `(tenantId, ...)` đã
  có (~50 bảng, verify `schema.prisma`); matrix kiểm mọi cặp.
- **Backup/restore drill** (TC-016/017, non-negotiable #11): backup mỗi tenant không chứa tenant
  khác; restore sandbox giữ tenantNo/code. Dùng module `backup/` đã có.
- **Entitlement** (TC-014/015): mỗi tenant chỉ thấy app blueprint cấp — kiểm chéo (vd T003 không
  thấy XBuilding).

## 7. Acceptance gate & Gaps

**Acceptance batch (khớp `docs/10`):** T003–T010 có registry + blueprint + seed plan và **hoạt
động** (exit gate E6); entitlement/menu/apps khác nhau giữa tenant; backup/restore riêng;
cross-tenant isolation PASS; blueprint/seed reusable + versioned; không hardcode X-TECH.

**Gaps:**
- **Module ngành chuyên sâu chưa có** (manufacturing/logistics/construction... engines) → demo
  bằng primitive chung; ghi rõ mức độ demo cho từng ngành trước khi seed. `docs/07` cho phép đổi
  ngành trước khi seed.
- **Phụ thuộc E3/E4/E5**: registry + launch factory + blueprint/seed catalog phải xong trước batch
  (hiện `Tenant` model chưa có tenantNo/class).
- **Khối lượng seed lớn**: 8 vertical pack cần biên soạn nội dung demo an toàn (no real personal
  data) — công việc dữ liệu, nằm ở `BLUEPRINT_SEED_PACK_PLAN`.
