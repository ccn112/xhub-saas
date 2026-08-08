# DATA-01 — XHub Organization/CRM Readiness Audit

**Ngày:** 2026-08-08
**Repo:** `xhub-saas/xhub-api` (NestJS + Prisma 7, platform DB `xhub` + `xoffice`)

## 1. Không có company/organization master nào đã tồn tại

`OrgUnit` (`prisma/schema.prisma:392`, và bản mirror ở `prisma-xoffice/schema.prisma:2119`) là cây phòng ban NỘI BỘ 1 tenant (domain HR/People) — luôn có `tenantId`, không có address/tax/license field. Grep `Organization|Company|Operator|Vendor|Supplier` (nghĩa CRM) trên cả 2 schema không ra kết quả nào khác. **DATA-01 organization master là domain hoàn toàn mới** — không có gì để tái dùng/đổi tên.

## 2. XOffice đã có sẵn "chỗ nối" cho việc này

`Customer.canonicalCustomerId` (`prisma-xoffice/schema.prisma:2226`) — `String?`, comment sẵn: *"reserved for future MDM MasterRecord link — NOT wired this pass"*. Đây chính xác là chỗ để lưu `Organization.id` (soft reference xuyên DB, giống hệt cách X2 lưu `xhub_project_id` — không FK cứng vì khác DB vật lý). Không cần thêm cột mới ở XOffice.

Không có lead-scoring nào tồn tại: đọc toàn bộ `src/opportunities/opportunities.service.ts` (FSM thuần), `src/revenue-kpi/revenue-kpi.service.ts` (KPI aggregation thuần), `src/commercial-catalog/` — không chỗ nào có logic tính điểm/scoring.

## 3. Pattern ingestion — MDM đã có, nhưng không tái dùng trực tiếp được

`MasterRecord.domain` (`prisma/schema.prisma:691`) đã ghi chú `PROJECT | GEOGRAPHY | ORG | ...` — `ORG` đã được người viết schema dự tính từ trước nhưng chưa build. Tuy nhiên — giống hệt lý do Geo/Provider Master hôm nay không tái dùng `SourceRecord`/`ImportJob`/`DuplicatePair` — các bảng đó bắt buộc `tenantId` NOT NULL và được nối vào RLS tenant-table set, không hợp với 1 master TOÀN CỤC (không tenant). **Quyết định: mirror pattern Geo** — tạo bộ 3 bảng riêng, tenant-free: `OrgImportJob`/`OrgSourceRecord`/`OrgDuplicatePair` (không dùng lại literal `Geo*` để tránh nhầm domain).

## 4. Crypto có sẵn, nhưng KHÔNG có hạ tầng identity/KMS

- HMAC-SHA256: chỉ 1 chỗ dùng — `src/webhook/hmac.util.ts`, verify chữ ký webhook, KHÔNG dùng cho identity.
- AES-256-GCM envelope: `src/backup/backup.crypto.ts` — thật, đang chạy, pattern "lưu key reference chứ không lưu key" — CÓ THỂ tái dùng làm template cho identity vault sau này, nhưng hiện tại chỉ single-purpose (backup).
- **Không có KMS/HSM nào** trong repo (grep `kms|envelope.encrypt` → 0 kết quả).
- **Không cần identity vault cho Wave A**: baseline Excel không chứa CCCD/CMND nào — cột `Người đại diện công khai` chỉ là TÊN công khai, không phải số định danh. `Secure identity ingest` toàn bộ "Chưa xác định" trong 205 dòng.

→ Quyết định: build `Person`/`PersonCompanyRole` cho TÊN đại diện công khai (an toàn, không cần vault), **hoãn hoàn toàn** `person_identity_key`/HMAC-identity/`person_identity_vault` tới khi có nguồn CCCD thật được authorize.

## 5. HTTP client pattern

- Internal service-to-service: `src/common/outbox-http.client.ts` (Injectable + fetch).
- External site (crawler): dùng pattern script độc lập như `scripts/geo-hapulico-ingest.mjs` hôm nay (native `fetch`, không phải NestJS service — crawler là batch job, không phải runtime dependency của API).

## 6. Global Project Catalog — đã có, nhưng mới seed 1 dự án

`GlobalProject` (`prisma/schema.prisma:825`) có `id`/`code`/`slug` — đủ làm FK target cho `ProjectOrganizationRelation`. **Thực tế:** chỉ Hapulico (1 dòng) đã seed — Wave C (migrate 6.000 dự án) chưa chạy. Project↔Operator matching build được ngay nhưng chỉ match thật với Hapulico cho tới khi Wave C chạy — ghi rõ giới hạn này, không giả vờ đã đủ 6.000.

## 7. Scheduling

Chỉ có `@Interval` (ms), không có `@Cron` nào trong repo. Crawler production thật (daily) sẽ theo pattern `src/backup/backup-scheduler.service.ts` — nhưng Wave A dùng script chạy tay (`scripts/data01-moc-crawl.mjs`), không lập lịch.

## 8. RLS convention

Tất cả bảng Organization/Qualification/Person/ProjectOrganizationRelation trong Wave A là **global** (không tenant) → theo đúng convention đã có (comment + KHÔNG liệt kê trong `TENANT_TABLES` của `scripts/rls-setup.mjs`, giống `MasterRecord`/`GlobalProject`).

## Gate check (theo doc §G1-G3 rút gọn cho Wave A)
- ✅ Xác nhận nguồn: Excel baseline (205 org, 206 event) + trang MOC sống (page 1 khớp 100% với baseline).
- ✅ Không company/organization master cũ nào bị đụng — domain hoàn toàn mới, an toàn thêm.
- ✅ Identity: không có raw CCCD trong nguồn hiện tại → hoãn vault, chỉ build phần tên công khai an toàn.
- ⚠️ Project graph: chỉ match được Hapulico cho tới khi Wave C (6.000 dự án) chạy — không phải lỗi, là giới hạn thực tế đã biết trước.
