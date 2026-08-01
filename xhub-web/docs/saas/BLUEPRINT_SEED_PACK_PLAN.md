# BLUEPRINT & SEED PACK PLAN

> Kế hoạch (docs-first, KHÔNG code) cho **Blueprint** (versioned/immutable) + **Seed Pack** (versioned demo data, không secret).
> Grounded trên `data/BLUEPRINT_CATALOG.csv`, `data/SEED_PACK_CATALOG.csv`, `contracts/tenant-blueprint.schema.json`, code `D:\Code\xhub-api` (`scripts/*-seed.mjs`, `src/identity`, `src/controlplane`, `src/backup`).
> Phase: **E5 — Blueprint & Seed Pack Catalog** (`PHASE_CATALOG.csv`), backlog `SAAS-050..053`. Non-negotiable **#9** (versioned/immutable) & **#10** (no plaintext password/secret).

## 0. Tài liệu liên quan

- `TENANT_LAUNCH_FACTORY_PLAN.md` — nơi blueprint+seed pack được apply (step 5–6).
- `TENANT_REGISTRY_IMPLEMENTATION_PLAN.md` — record tenant giữ `blueprintId`.
- `T002_REAL_ESTATE_DEMO_PLAN.md` — dùng `BP-RE-002` + `SP-RE-DEMO`.
- `SAAS_POSITIONING_DELTA_ANALYSIS.md` — bỏ giả định X-TECH là sản phẩm; vertical không có code branch riêng.

## 1. Định nghĩa

### Blueprint = "khuôn vận hành 1 vertical" (không dữ liệu demo)

Theo `contracts/tenant-blueprint.schema.json` + `docs/05_BLUEPRINT_SEED_PACK_GOVERNANCE.md`:

```
TenantBlueprint { id, version, name, modules[], seedPacks[], compatiblePlans[],
                  status: DRAFT|PUBLISHED|SUPERSEDED|RETIRED }
```

Một Blueprint gói: **tập app được bật + roles + org template + workflows + menu/entitlement** cho một ngành. Nguồn danh mục `data/BLUEPRINT_CATALOG.csv`:

| Blueprint ID | Tên | Tenant | Phạm vi |
|---|---|---|---|
| `BP-BASE-ENTERPRISE` | Base Enterprise | Dùng chung | Org, roles, approval, ticket, booking, records, backup |
| `BP-TECH-001` | Technology Solution Provider | T001 | Sales, delivery, launch, support, customer success |
| `BP-RE-002` | Real Estate Developer | T002 | Developer/project master, sales, booking, living/ops |
| `BP-MFG-003` | Manufacturing Enterprise | T003 | Purchase, maintenance, quality, asset, inventory |
| `BP-DIST-004` | Distribution & Retail | T004 | CRM, discount, inventory, delivery, customer service |
| `BP-CONST-005` | Construction Contractor | T005 | Project, submittal, material, subcontractor, acceptance |
| `BP-HOSP-006` | Hospitality Services | T006 | Service ops, shifts, assets, quality |
| `BP-EDU-007` | Education Organization | T007 | Admission, training, schedule, learner care |
| `BP-HC-008` | Healthcare Administration | T008 | Administration, shifts, access, asset, records |
| `BP-LOG-009` | Logistics & Transport | T009 | Dispatch, fleet, resource, ticket, ERP |
| `BP-PS-010` | Professional Services | T010 | CRM, consulting projects, records, customer success |

**Kế thừa:** vertical pack **kế thừa Base Enterprise** (`docs/05`): `BP-*-NNN` inherit `BP-BASE-ENTERPRISE` (modules/roles nền), chỉ thêm phần ngành. Không tạo code branch cho từng tenant (non-negotiable #4, gates "không hardcode X-TECH").

### SeedPack = "dữ liệu demo có version" (không secret)

Nguồn `data/SEED_PACK_CATALOG.csv`:

| Seed Pack ID | Nội dung |
|---|---|
| `SP-BASE-ORG` | Org units, positions, roles, scopes |
| `SP-BASE-OFFICE` | 12 procedures, forms, SLA, notifications |
| `SP-BASE-RECORDS` | Classification, retention, document types |
| `SP-BASE-BACKUP` | Backup policy, retention, restore approval |
| `SP-XTECH-OPS` | Users, org, workflows, directives, tickets, bookings (dữ liệu vận hành T001) |
| `SP-RE-DEMO` … `SP-PS-DEMO` | Demo data từng ngành (T002–T010) |

Mỗi SeedPack **versioned + có dependencies** (`docs/05`). `SP-*-DEMO` phụ thuộc các `SP-BASE-*`.

## 2. Tính versioned & immutable (non-negotiable #9)

- **Blueprint published là immutable** (`docs/05`). Sửa = tạo `version` mới, bản cũ chuyển `SUPERSEDED` (theo enum `status`). Đúng pattern đã dùng cho **workflow version** trong code: `identity.service.ts` seed `WorkflowVersion` immutable v1 (`{ version:1, checksum, publishedAt, definition }`, chỉ tạo khi chưa có) và `AppRoleMapping` "version rows are immutable: only ensure existence" (`controlplane.service.ts:99-119`). Blueprint/SeedPack tái dùng chính khuôn version+checksum này.
- SeedPack version cũng immutable; `dependencies` + `compatibility matrix` (`SAAS-052`) quyết định pack nào chạy với blueprint/plan nào (`compatiblePlans[]` trong schema).
- **Publish/registry:** màn `PS-08 Blueprint Catalog` + `PS-09 Blueprint Detail` (modules/workflows/roles/data/upgrade path) và `PS-10 Seed Pack Catalog` (dependencies, dry-run, versions). API: `GET /api/platform/blueprints`, `GET /api/platform/seed-packs`, `POST /api/platform/seed-packs/{id}/dry-run`.

## 3. Không secret trong seed (non-negotiable #10)

- SeedPack **KHÔNG chứa plaintext password/secret** (`docs/05`). Đã có sẵn primitive kiểm: `src/backup/backup.tables.ts` `assertNoSecretFields()` (guard `MUST_NOT_LEAK`) dùng khi export backup — **tái dùng** guard này để validate mọi SeedPack trước publish (fail publish nếu phát hiện field secret).
- Admin đầu tiên tạo qua invite flow (`SAAS-043`), không nhét mật khẩu vào seed.

## 4. Dry-run trước apply

- `docs/05`: "Dry-run trước apply". Endpoint `POST /api/platform/seed-packs/{id}/dry-run` (outline) báo trước "would-write counts" mà không ghi — đúng pattern đã có ở `BackupService.restore(mode:'dry-run')` (verify checksum/schema, trả `wouldWrite:false` + `tables` counts, KHÔNG ghi). Seed pack dry-run tái dùng khuôn report này.

## 5. Apply blueprint + seed pack lúc launch

Trong `TENANT_LAUNCH_FACTORY_PLAN.md` step 4–6:

1. `enable-apps`: từ `blueprint.modules[]` → `setTenantApplication(tenantId, appCode, 'enabled')` (idempotent upsert `TenantApplicationInstance`, đã thật).
2. `apply-blueprint`: nạp roles/org-template/workflows/menu/entitlement theo version blueprint (immutable) vào tenant đích.
3. `load-seed-pack`: theo `launchRequest.seedPackIds[]`, chạy dry-run → apply. Apply idempotent skip-by-code (§6).

Vì blueprint immutable + seed idempotent, chạy lại step (resume/retry của factory) an toàn.

## 6. Tiến hoá seeder hiện tại → seed pack tham số hoá

Hiện trạng (verified): các seeder `scripts/*-seed.mjs` (`directives/tickets/bookings/announcements/records/identity-accounts/role-registry/xoffice-*`) đều:

- **Hardcode `tenant-xtech`** (map `OU_BY_CODE` cố định, tenant literal).
- Idempotent kiểu **insert-by (tenantId, code) ON CONFLICT DO NOTHING** (verified `directives-seed.mjs`), chạy trực tiếp Postgres dưới `app.bypass_rls='on'`, server không cần chạy.
- `IdentityService.seed` / `ControlplaneService.seed` cũng upsert idempotent theo id, dưới `withBypass`.

**Tiến hoá:** giữ nguyên tính idempotent skip-by-code + bypass, chỉ **tham số hoá tenant đích**:

- `tenantId` truyền vào thay vì literal `tenant-xtech`; map code→id (org unit, position…) resolve theo tenant đang seed thay vì bảng cứng.
- Gom các seeder thành **SeedPack manifest** có `id + version + dependencies + checksum` (khuôn version giống WorkflowVersion §2).
- Dữ liệu vận hành T001 hiện nằm rải rác trong các seeder → gói thành **`SP-XTECH-OPS`** (users, org, workflows, directives, tickets, bookings — đúng mô tả catalog).

## 7. 5 điểm hardcoded-xtech chuyển vào seed pack T001

Đối chiếu `TENANT_REGISTRY_IMPLEMENTATION_PLAN.md §6`. Riêng phần **dữ liệu** (không phải tra cứu slug) chuyển hẳn vào **`SP-XTECH-OPS`** / `SP-BASE-*`:

| # | Điểm code | Bản chất | Đích trong seed pack |
|---|---|---|---|
| 1 | `identity.service.ts:75-93` khối `if (tenantId==='tenant-xtech')` seed `PositionAssignment` history (pa-sales/tech/cfo…) | dữ liệu org T001 | `SP-XTECH-OPS` (org/history), apply theo tenant, bỏ nhánh key. |
| 2 | `mdm.service.ts:455/482` `XTECH` const + demo import job `seed-mdm-job-xtech` | dữ liệu master demo | `SP-XTECH-OPS` hoặc `SP-BASE-*` tuỳ phạm vi, tham số tenant. |
| 3 | `controlplane.service.ts:58-127` enable `x1/x2/xweb` + sample bindings cho X-TECH | app-enable + binding | thuộc **blueprint `BP-TECH-001`** (modules) + `SP-XTECH-OPS` (bindings mẫu). |
| 4 | `xoffice.service.ts:107-114` seed tenant/workflow với name `'XTech'` | tenant metadata + workflow | metadata do registry giữ; workflow defs vào `SP-BASE-OFFICE`/`SP-XTECH-OPS`. |
| 5 | `scripts/*-seed.mjs` (directives/tickets/bookings…) hardcode `tenant-xtech` | dữ liệu vận hành | gói thành `SP-XTECH-OPS` tham số hoá tenant. |

Kết quả: T001 chỉ khác các tenant khác ở **chọn blueprint `BP-TECH-001` + seed pack `SP-XTECH-OPS`**, KHÔNG ở code branch (non-negotiable #1).

## 8. Upgrade & rollback (SAAS-053)

- `docs/05`: "Tenant upgrade dùng compatibility matrix và rollback." Nâng blueprint = apply version mới nếu `compatiblePlans` khớp; rollback về version `SUPERSEDED` trước đó. Vì mỗi version immutable + có checksum, rollback là chọn lại version cũ, không sửa tại chỗ.

## 9. Acceptance (map `docs/10_ACCEPTANCE_GATES.md`)

- Blueprint/seed **reusable & versioned**; T002–T010 dùng pack khác nhau (`docs/07`).
- Tenant entitlement/menu/apps khác nhau theo blueprint.
- Không secret trong seed (guard §3).
- Không code branch riêng cho vertical/X-TECH.

## 10. Gaps handoff-vs-code

- **Chưa có** model `Blueprint`/`SeedPack` + version registry — mới có CSV catalog + JSON schema. Cần tạo (tái dùng khuôn version+checksum của `WorkflowVersion`/`AppRoleMapping`).
- Seeder hiện **hardcode tenant-xtech** và map code→id bằng bảng cứng → phải tham số hoá trước khi thành pack.
- `assertNoSecretFields()` mới dùng cho backup; cần nối vào pipeline publish seed pack.
- Chưa có compatibility matrix / dry-run cho seed pack (chỉ backup restore có dry-run làm mẫu).
- Blueprint "menu/entitlement" phụ thuộc mô hình permission platform/tenant chưa hoàn chỉnh (xem `PLATFORM_VS_TENANT_PERMISSION_PLAN.md`).
