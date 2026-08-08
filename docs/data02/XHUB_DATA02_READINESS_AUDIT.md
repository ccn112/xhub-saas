# DATA-02 — Building Service Contractor Master — Readiness Audit

**Ngày:** 2026-08-08
**Nguồn:** `DATA02_OFFICIAL_AGENT_RESEARCH_PACKAGE_20260808` (ChatGPT Research Agent thu thập, Claude tích hợp — **không** phải Claude tự đi tìm danh sách).

## 1. Baseline thật — đã đọc trực tiếp, không giả định

Workbook `01_DATA02_MASTER_AGENT_RESEARCH.xlsx`, 14 sheet. Sheet quan trọng nhất — `12_All Provider Universe` (153 dòng):

| Verification | Số dòng |
|---|---|
| DISCOVERED | 124 |
| VERIFIED_SEED | 18 |
| FIRST_PARTY_VERIFIED | 7 |
| DIRECTORY_VERIFIED | 4 |

| Research state | Số dòng |
|---|---|
| PARTIAL | 102 |
| RESEARCH_REQUIRED | 30 |
| ENRICHED | 21 |

Phủ dữ liệu: `Address` 123/153, `Phone` 121/153, `Website` 112/153 non-null — nhưng đây là TỔNG, không đều: 18 dòng `VERIFIED_SEED`/`FIRST_PARTY_VERIFIED` (sheet `01_Provider Master`) có địa chỉ/điện thoại/email/website/MST đầy đủ thật (vd Aden Services, PAN Services); 124 dòng `DISCOVERED` (sheet `11_Agent Discovery`) phần lớn chỉ có tên + category + 1 source URL, các field khác rỗng.

Phân bổ theo category (`Categories`, có thể multi-value):
```
SECURITY 49 · FM_IFM 20 · ELEVATOR 18 · CLEANING 14 · FIRE_SAFETY 11
GENERATOR_MAINTENANCE 11 · WASTEWATER 7 · BMS_AUTOMATION 5 · PEST_CONTROL 5
LANDSCAPING 4 · vài dòng multi-category (MEP;HVAC;FIRE_SAFETY, ...)
```

**Kết luận:** 153 không phải toàn bộ thị trường (doc tự nói rõ: cleaning directory công khai ~900+, PCCC ~1.000+, elevator ~300+, generator ~180+) — đây là universe đã lọc để liên quan vận hành toà nhà, KHÔNG phải "toàn bộ danh bạ". Chỉ 18 dòng đủ bằng chứng để lên canonical ngay; phần còn lại vào hàng đợi review.

## 2. Tái dùng schema đã có — không cần bảng mới cho phần lõi

Từ việc build DATA-01 hôm nay, XHub đã có sẵn:

- `Organization` (`prisma/schema.prisma:1259`) — đúng hình dạng pháp nhân (legalName/normalizedName/taxCode UNIQUE/address/contact). `organizationType` là string tự do (default `PROPERTY_OPERATOR`) — thêm giá trị `BUILDING_SERVICE_CONTRACTOR` **không cần migration**.
- `OrganizationQualification`/`OrganizationFieldObservation`/`OrganizationLocation` — evidence/compliance-per-field đã có sẵn, dùng được cho DATA-02's compliance-by-category (ANTT cho SECURITY, PCCC cho FIRE_SAFETY...) mà không cần bảng mới cho Wave A (chưa làm live regulator lookup, chỉ lưu ghi chú compliance dạng field observation).
- `ProjectOrganizationRelation` (`prisma/schema.prisma:1467`) — đã đúng shape cho "project↔provider graph" doc yêu cầu (`global_project_id, organization_id, relationship_type, relationship_status, confidence, source_evidence_id`) — chỉ cần `relationshipType='SERVICE_PROVIDER'` thay vì `'PROPERTY_MANAGER'`, **không cần bảng mới**.
- `OrgImportJob`/`OrgSourceRecord`/`OrgDuplicatePair` — pipeline staging→normalize→dedupe→commit đã có, `domain` là string tự do (`'ORGANIZATION'`), chỉ cần `sourceSystem='data02_agent_research'` mới.

**Cần thêm:** `Organization.researchStatus` (field mới, migration) — vocabulary DATA-02 (`VERIFIED_SEED|FIRST_PARTY_VERIFIED|DIRECTORY_VERIFIED|DISCOVERED|NEED_ENTITY_RESOLUTION|NEED_COMPLIANCE_VERIFY|STALE|REJECTED_NOT_RELEVANT`) khác hẳn `OrganizationQualification.status` (đó là trạng thái GIẤY PHÉP, không phải trạng thái NGHIÊN CỨU) — không được lẫn 2 khái niệm.

`ServiceCapability` (bảng mới, nhỏ): org ↔ category code (SECURITY/CLEANING/ELEVATOR/...) — doc §2 (Service Taxonomy), chưa có bảng nào trong XHub biểu diễn "1 org làm nhiều loại dịch vụ".

## 3. Không đụng `Provider` (Geo/POI Wave A)

`Provider` (`prisma/schema.prisma:960`, xây cho Geo hôm nay) mô hình 1 **địa điểm vật lý** gắn với `Place`/tìm-gần-dự-án, vòng đời DISCOVERED→VERIFIED→CLAIMED→PARTNER 4 bước. Nhà thầu dịch vụ toà nhà (DATA-02) là **pháp nhân trước**, có thể phục vụ toàn quốc không gắn 1 địa điểm — khớp `Organization` hơn nhiều. Quyết định: **DATA-02 = `Organization` rows, không phải `Provider` rows.**

## 4. Không cần crawl thật

Khác DATA-01 (phải tự crawl moc.gov.vn), DATA-02 dữ liệu **đã được Research Agent thu sẵn** — Claude chỉ import + xử lý, không tự đi tìm nhà cung cấp trên web (đúng như doc §0/§13 nói rõ).

## Gate check (rút gọn cho Wave A)
- ✅ Nguồn xác nhận: Excel baseline 153 dòng, đọc trực tiếp.
- ✅ Không company master nào cũ bị đụng — tái dùng `Organization` đã có từ DATA-01.
- ✅ 18 dòng đủ bằng chứng → canonical ngay; 135 dòng còn lại → review queue, KHÔNG tự động promote (đúng luật "never verify directory candidate blindly").
- ⚠️ Project graph: vẫn chỉ match được Hapulico cho tới Wave C — giống DATA-01/Geo.
