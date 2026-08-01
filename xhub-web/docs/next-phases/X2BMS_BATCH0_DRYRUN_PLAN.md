# X2BMS Batch-0 Dry-Run Plan (PH-03)

> Mục tiêu: đưa `/projects` lên **Shared MDM**, diễn tập pipeline nhập với batch-0 synthetic
> 50 dự án (staging→normalize→match→dedup→review→commit), review trùng có kiểm soát,
> **không auto-merge fuzzy**.
> Nguồn chuẩn: handoff `docs/07_DOCUMENT_AND_PROJECT_MIGRATION.md`, `data/FLOW_CATALOG.csv`
> (FLOW-11), `SCREEN_CATALOG` (PRJ-01/02, MDM-01/02/03), `seed/mdm_projects_batch0.seed.json`,
> backlog **NX-033..NX-035**.
> Anh em: `DOCUMENT_MIGRATION_PLAN.md`, `SEED_MIGRATION_PLAN.md`,
> `PHASE_EXECUTION_PLAN.md`, `CURRENT_RELEASE_DELTA_ANALYSIS.md`.

## 1. Nền tảng đã có (verified)

Module MDM `xhub-api/src/mdm/*` đã có (`mdm.controller.ts`, `mdm.normalize.ts`):

```
POST  /api/mdm/import-jobs                 tạo import job (dry-run staging)
GET   /api/mdm/import-jobs/:id             trạng thái + metrics
POST  /api/mdm/import-jobs/:id/commit      commit sau review
GET   /api/mdm/master-records              list master canonical
GET   /api/mdm/master-records/:id          master + sources
GET   /api/mdm/duplicate-pairs             cặp nghi trùng
POST  /api/mdm/duplicate-pairs/:id/resolve resolve (merge/split thủ công)
GET   /api/mdm/tenant-overlays             overlay theo tenant
PUT   /api/mdm/tenant-overlays             ghi overlay
```
Có sẵn `mdm.normalize.ts` (chuẩn hoá) + khái niệm MasterRecord/SourceRecord/overlay/
DuplicatePair. → Pipeline dry-run/match/dedup/review/commit **đã có backend**; delta là
**đấu nối `/projects` + màn review + diễn tập batch-0**.

## 2. Trạng thái `/projects` hiện tại

`src/app/(app)/projects/page.tsx` đọc **seed** `collection<Project>("projects")` +
`collection("milestones")` (đã verify) — KHÔNG phải MDM. Handoff (PRJ-01 `replace-demo`,
NX-033 "No static/demo list") yêu cầu chuyển sang MDM API.

## 3. Model đích vs code (ranh giới handoff-vs-code)

Handoff 07 đặt tên **`RealEstateProjectMaster`** + **`TenantMasterOverlay`**. Code hiện có
model MDM **tổng quát** (MasterRecord/SourceRecord/DuplicatePair/tenant-overlay) chứ chưa
thấy entity chuyên biệt "RealEstateProjectMaster". → Coi `RealEstateProjectMaster` là
**projection/loại master `PROJECT`** trên MDM tổng quát (dùng `masterType`/`sourceKey`), KHÔNG
tạo store dự án riêng. `TenantMasterOverlay` = `tenant-overlays` sẵn có. Cần xác nhận field
bất động sản (`developerName`, `provinceCode`, `districtText`, `projectTypeCode`, `statusCode`,
`visibility`, `qualityScore`) map vào payload MDM khi build; nếu thiếu, bổ sung field vào
schema MDM, không nhân đôi module.

## 4. Dữ liệu batch-0 (verified)

`seed/mdm_projects_batch0.seed.json` = **50 bản ghi** `X2P-00001..00050`,
`sourceKey="x2bms-projects-batch0"`, mỗi bản có: `rawName`, `normalizedName`, `developerName`,
`provinceCode/Name`, `districtText`, `projectTypeCode` (CHUNG_CU/KHU_DO_THI…),
`statusCode` (PLANNING/DEVELOPING…), `visibility=SHARED_WITH_VISIBILITY`, `qualityScore`,
`duplicateCandidateOf`, `sourceKind="REALISTIC_SYNTHETIC_FOR_PIPELINE_TEST"`,
**`publishAllowed=false`**.

→ 100% synthetic, chỉ để **kiểm thử pipeline**. Handoff 07: "Không publish production master
từ seed này". FLOW-11 guardrail: "Dry-run first".

## 5. Pipeline dry-run (FLOW-11 · NX-034)

```
Upload batch-0 → Staging → Mapping → Validate → Normalize → Match → Duplicate review → (commit sample)
```

1. **Staging**: `POST /api/mdm/import-jobs` với 50 record, `sourceKey=x2bms-projects-batch0`,
   chế độ dry-run. Không đụng master canonical.
2. **Mapping**: ánh xạ cột nguồn → field master (MDM-01 `/admin/master-data/imports`).
3. **Validate**: tỉ lệ hợp lệ, thiếu tỉnh/huyện, `projectTypeCode`/`statusCode` không hợp lệ.
4. **Normalize**: `mdm.normalize.ts` (bỏ dấu/chuẩn tên) → `normalizedName`.
5. **Match**: dò master hiện có + nội bộ batch; sinh `duplicate-pairs`. Dùng
   `duplicateCandidateOf` trong seed làm ground-truth để đối chiếu độ chính xác match.
6. **Duplicate review (MDM-02, NX-035)**: `GET /api/mdm/duplicate-pairs` +
   `POST /duplicate-pairs/:id/resolve` — **con người quyết định merge/split**. Giao diện
   compare hai bản ghi cạnh nhau. Không có ngưỡng tự động gộp.
7. **Commit sample**: `POST /api/mdm/import-jobs/:id/commit` chỉ với tập mẫu đã duyệt, và vì
   `publishAllowed=false` → **không publish production master**. Chỉ tạo master trong phạm vi
   diễn tập/sandbox.

### Nguyên tắc "no fuzzy auto-merge" (NX-035 · U30)
- Không có ngưỡng similarity nào tự động gộp. Mọi cặp trùng chỉ chuyển sang MDM-02 để người
  DATA_STEWARD quyết định. Match chỉ *đề xuất*, resolve là hành động thủ công có audit.

## 6. Duplicate review UI + tenant overlay (NX-035)

- **MDM-02 `/admin/master-data/duplicates`** (refine-live): compare/merge/split thủ công.
- **Tenant overlay (PRJ-02, MDM)**: master canonical dùng chung + `TenantMasterOverlay`
  (`GET/PUT /api/mdm/tenant-overlays`) cho phép tenant ghi đè nhãn/trạng thái cục bộ mà không
  đổi master gốc (U31 "Tạo tenant overlay cho dự án").
- **PRJ-01 `/projects`** (replace-demo → NX-033): đọc `GET /api/mdm/master-records`
  (masterType PROJECT) + overlay, bỏ hoàn toàn `collection("projects")`.
- **PRJ-02 `/projects/[id]`** (new-live): canonical + overlay + sources (`master-records/:id`).

## 7. Chỉ số dry-run / reconciliation (NX-034 acceptance)

Báo cáo diễn tập phải gồm:
- Số record staged / valid / invalid (+ lý do).
- Số normalize thành công; số match candidate; số duplicate-pair sinh ra.
- Đối chiếu match vs `duplicateCandidateOf` (precision/recall của bước match).
- Số resolve thủ công (merge/split) + audit.
- Reconciliation: `staged == valid + invalid`; `committed_sample <= approved`; publish = 0.
- Gate **G-06 mdm** (`npm run test:mdm`) PASS.

## 8. Ranh giới production
- Batch-0 (50 synthetic) chỉ để diễn tập. **6.000 bản ghi thật chỉ nạp khi có nguồn X2BMS
  thực** (source `x2bms` live). Trước đó tuyệt đối không publish master từ seed
  (`publishAllowed=false`, handoff 07). Khi có nguồn thật: lặp lại đúng pipeline này ở quy mô
  6.000, giữ nguyên nguyên tắc dry-run-first + no-fuzzy-auto-merge.

## 9. Màn & backlog
| Screen | Route | Trạng thái | Backlog |
|---|---|---|---|
| PRJ-01 | /projects | replace-demo | NX-033 |
| PRJ-02 | /projects/[id] | new-live | NX-033 |
| MDM-01 | /admin/master-data/imports | refine-live | NX-034 |
| MDM-02 | /admin/master-data/duplicates | refine-live | NX-035 |
| MDM-03 | /admin/master-data/quality | refine-live | NX-034 |

UAT liên quan: U28 (projects đọc MDM thật), U29 (dry-run 50), U30 (no fuzzy auto-merge),
U31 (tenant overlay).
