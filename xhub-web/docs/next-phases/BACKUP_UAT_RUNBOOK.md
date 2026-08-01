# Backup Operations & UAT Runbook (PH-04)

> Mục tiêu: đưa backup từ "engine có sẵn" sang **vận hành đầy đủ** (schedule/retention/alert/
> quota + restore approval + sandbox drill), và mở rộng UAT `/docs/test` từ U1–U17 lên U1–U40
> với evidence + signoff, đạt tiêu chí RC pilot (không P0 defect).
> Nguồn chuẩn: handoff `docs/08_BACKUP_UAT_RELEASE.md`, `data/FLOW_CATALOG.csv` (FLOW-12/13/14),
> `tests/UAT_SCENARIOS_U1_U40.csv`, `tests/AUTOMATED_GATE_MATRIX.csv`, SCREEN (BKP/RST/UAT),
> backlog **NX-040..NX-045**.
> Anh em: `XOFFICE_OPERATIONAL_DELTA_PLAN.md`, `DOCUMENT_MIGRATION_PLAN.md`,
> `X2BMS_BATCH0_DRYRUN_PLAN.md`, `PHASE_EXECUTION_PLAN.md`, `CURRENT_RELEASE_DELTA_ANALYSIS.md`.

## 1. Nền tảng đã có (verified)

Engine `xhub-api/src/backup/*` (`backup.controller.ts`, `backup.service.ts`, `backup.crypto.ts`):

```
POST /api/backup             tạo backup job (manifest + checksum + AES-256-GCM)
GET  /api/backup             list job
GET  /api/backup/restores    list restore job
GET  /api/backup/:id         chi tiết + manifest/inventory
GET  /api/backup/:id/verify  integrity verify (checksum)
POST /api/backup/:id/restore restore (mode: 'dry-run' | 'sandbox')
```
Đã có: manifest/checksum, mã hoá AES-256-GCM (`backup.crypto.ts`), restore sandbox cross-tenant
**không ghi đè tenant nguồn** (`<source>:restore-sandbox`), identity remap + load into sandbox,
guard MUST_NOT_LEAK (isolation). FE: `src/features/tenant-admin/backup.server.ts` đọc
`/api/backup` + `/api/backup/restores` (degrade demo khi backend chưa sẵn).

## 2. Gap giữa handoff và code (phải xây)

| Handoff PH-04 yêu cầu | Code hiện tại | Delta |
|---|---|---|
| Daily/weekly/monthly schedule | **Không thấy** cron/schedule trong `backup.service.ts` | **build** scheduler backup |
| Retention cleanup + Quota | Không thấy | **build** retention + quota |
| Failure alert | Không thấy | **build** alert khi job FAIL |
| Periodic integrity verify | Có `:id/verify` (thủ công) | thêm lịch verify định kỳ |
| Sandbox restore drill | Có `mode:'sandbox'` | thêm quy trình drill + checklist |
| **Production restore approval** | `RestoreRequestDto` chỉ `mode: 'dry-run'\|'sandbox'` — **không có mode production, không có field approval** | **build** approval workflow |

→ NX-040 (schedule/retention/alert) và NX-041 (restore approval) là **backend mới**; engine
lõi (export/manifest/checksum/encrypt/sandbox) tái dùng nguyên.

## 3. Backup operations design (NX-040 · FLOW-12)

- **Schedule**: cấu hình daily/weekly/monthly cho mỗi tenant (BKP-01 `/admin/backups`,
  refine-live). Job chạy qua scheduler → gọi `POST /api/backup` với `kind` tương ứng.
  Guardrail FLOW-12: "No secrets" trong manifest.
- **Retention**: giữ N daily / M weekly / K monthly; cleanup gói quá hạn (không xoá gói đang
  bị khoá bởi restore đang chờ duyệt).
- **Quota**: giới hạn dung lượng/tần suất theo tenant; cảnh báo khi gần ngưỡng.
- **Failure alert**: job FAIL/checksum mismatch → cảnh báo BACKUP_ADMIN (U34 dùng
  `:id/verify` FAIL làm bằng chứng).
- **Periodic integrity verify**: định kỳ chạy `:id/verify` (checksum) trên gói mới nhất.
- Màn: BKP-01 (schedule/retention/alerts), BKP-02 `/admin/backups/[id]` (manifest/inventory/
  checksum). UAT: U32 (backup thủ công), U33 (schedule tạo job đúng), U34 (checksum FAIL).

## 4. Restore approval workflow (NX-041 · FLOW-13)

Restore **production** cần đủ (handoff 08):
1. Verify PASS (`:id/verify`).
2. Sandbox PASS (`mode:'sandbox'` + isolation test).
3. Conflict review (reconcile).
4. Isolation PASS (MUST_NOT_LEAK không xuất hiện — U38).
5. **Data owner approval**.
6. **Backup admin approval**.
7. Write-fence plan.

**Ràng buộc cứng: người yêu cầu KHÔNG tự duyệt yêu cầu restore của chính mình**
(requester ≠ approver). Đây là quy tắc mới cần thêm vào `RestoreRequestDto`/service
(hiện chỉ có `mode` + `targetTenantId` + `tamper` test-hook). U36 kiểm thử "chặn production
restore thiếu approval". Màn RST-01 `/admin/restores` (refine-live): sandbox/approval/state.

Tách bạch approval production khỏi sandbox (FLOW-13 guardrail: "Production separate approval").

## 5. X-TECH sandbox restore drill (NX-042 · U35/U37/U38)

Các bước drill:
1. Chọn backup gần nhất → `GET /api/backup/:id/verify` (checksum PASS).
2. `POST /api/backup/:id/restore` với `mode:'sandbox'` → nạp vào `<tenant-xtech>:restore-sandbox`
   (không đụng tenant nguồn).
3. Identity remap + reconcile (conflict review).
4. **Rebuild UnifiedWorkItem** sau restore (U37) — dùng `POST /api/xoffice/work-items/rebuild`
   để dựng lại projection SoR trong sandbox.
5. **Isolation test / MUST_NOT_LEAK check (U38)**: xác nhận marker `MUST_NOT_LEAK`
   (tenant `demo-isolation`) **không xuất hiện** trong dữ liệu sandbox. Guard đã có ở
   `assertTenantScope` (`src/xhub/lib/seed.ts`) + service backup; drill phải chạy assertion này
   như bước ký. Gate **G-07 backup** (`npm run test:backup`) + G-03 RLS PASS.
6. Sign-off drill (BACKUP_ADMIN + AUDITOR).

## 6. UAT U1–U40 (NX-043, NX-044 · FLOW-14)

### Hạ tầng đã có (verified)
- Console `/docs/test` (`src/app/(app)/docs/test/page.tsx`, UAT-01 existing-live) đang chạy
  U1–U17.
- Persistence server: FE proxy `src/app/api/testruns/route.ts` (GET/PUT) → BFF `/api/testruns`
  (JSON theo tenant+user, identity `tenant-xtech`/`user-nam`), degrade localStorage khi 502.

### Delta (NX-043/044)
- **Mở rộng console U1→U40** theo `tests/UAT_SCENARIOS_U1_U40.csv` (40 kịch bản, U01–U40,
  P0 trừ U40=P1). Không đổi cơ chế persistence — tái dùng `/api/testruns`.
- Mỗi test run lưu (handoff 08): **Assignee, Environment/build, Input account, Evidence,
  Result, Defect link, Retest result, Business sign-off**.
- Màn **UAT-02 `/docs/test/runs/[id]`** (new-live, QA_ADMIN): evidence/defects/signoff chi tiết.

### Bản đồ UAT theo phase
- PH-00/01: U01–U13 (auth, user/role/delegation/resolver).
- PH-02: U14–U25 (mua sắm <200tr/≥200tr, supplement/resubmit, withdraw, delegate approve,
  manual execution+evidence, directive+escalation, ticket, booking conflict, announcement ack)
  — xem `XOFFICE_OPERATIONAL_DELTA_PLAN.md`.
- PH-03: U26–U31 (document version, deep link cũ, projects MDM, dry-run 50, no fuzzy merge,
  overlay) — xem `DOCUMENT_MIGRATION_PLAN.md`, `X2BMS_BATCH0_DRYRUN_PLAN.md`.
- PH-04: U32–U40 (backup thủ công/schedule/checksum FAIL, restore sandbox, chặn production
  thiếu approval, rebuild UnifiedWorkItem, MUST_NOT_LEAK, menu theo role, AI suggestion bị từ chối).

## 7. Automated gate matrix (chạy mỗi phase)
`tests/AUTOMATED_GATE_MATRIX.csv`: G-01 tsc, G-02 web build, G-03 RLS 35 bảng, G-04 workflow
smoke, G-05 control plane, G-06 mdm, G-07 backup, G-08 records, G-10 condition AST, G-11 authz
(AUTH_ENFORCE true), G-12 secrets, G-13 visual regression, G-14 a11y. Tất cả PASS là điều kiện
release cùng UAT.

## 8. Tiêu chí thoát RC pilot (NX-045 · FLOW-14 "P0 100%")
- **100% kịch bản P0 (U01–U39) PASS** với evidence + business sign-off server-persisted.
- **Không còn P0 defect** (bugfix/performance/a11y đã xử lý — NX-045).
- Toàn bộ gate G-01..G-14 PASS.
- MUST_NOT_LEAK không xuất hiện ở mọi drill/isolation test (U38, G-03).
- Production restore chỉ cho phép khi đủ 7 điều kiện §4 và requester ≠ approver.

## 9. Màn & backlog
| Screen | Route | Trạng thái | Backlog |
|---|---|---|---|
| BKP-01 | /admin/backups | refine-live | NX-040 |
| BKP-02 | /admin/backups/[id] | refine-live | NX-040 |
| RST-01 | /admin/restores | refine-live | NX-041/042 |
| UAT-01 | /docs/test | existing-live (U1→U40) | NX-043 |
| UAT-02 | /docs/test/runs/[id] | new-live | NX-044 |
