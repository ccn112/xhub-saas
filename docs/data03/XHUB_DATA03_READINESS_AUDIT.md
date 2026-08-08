# DATA-03 — Equipment/Material/Spare-Part Master — Readiness Audit

**Ngày:** 2026-08-08
**Nguồn:** `DATA03_OFFICIAL_AGENT_RESEARCH_PACKAGE_20260808_v2_MEDIA` (v2 — bổ sung yêu cầu logo/media bắt buộc so với bản v1).

## 1. Baseline thật

Workbook `01_DATA03_MASTER.xlsx`, 16 sheet, đã đọc trực tiếp:

| Sheet | Rows | Nội dung |
|---|---|---|
| `01_Product Taxonomy` | 20 | category code cố định (ELEVATOR, HVAC_VRF, PUMP_WATER, GENERATOR, UPS_POWER, BMS_AUTOMATION, CCTV_VIDEO, FIRE_ALARM, EV_CHARGER, SPARE_PART...) |
| `02_Supplier Master` | 25 | manufacturer/distributor/installer, **đã có sẵn website + logo/favicon URL** (vd KONE, Schindler dùng `google.com/s2/favicons?domain=...`) |
| `03_Product Catalog` | 61 | model/SKU thật, `Product ID` từ P-D03-0001 đến P-D03-0103 (KHÔNG liên tục — chỉ 61/103 mã được đưa vào catalog chính thức) |
| `04_Channel Relations` | 14 | org ↔ brand ↔ relation type (vd `MANUFACTURER_INSTALLER_MAINTAINER`) |
| `05_Price Observations` | 7 | giá thật + nguồn + ngày quan sát, 1 dòng không gắn `Product ID` (giữ nguyên, không ép match) |
| `06_Installed Base` | 5 | bằng chứng lắp đặt thật (vd Khai Sơn City — Mitsubishi NEXIEZ-MR 12 thang máy, U Series 4 thang cuốn) |
| `07_Agent Discovery` | 14 | supplier candidate thêm, đã có sẵn logo URL cho từng dòng |
| `15_Supplier Media` | 22 | field contract cho `supplier_media` (không phải data, là schema mô tả) |

## 2. Tái dùng — Organization, không tạo Manufacturer riêng

25 dòng "Supplier Master" đều là công ty thật (KONE Vietnam, Schindler Vietnam Ltd....) — đúng shape `Organization` (`prisma/schema.prisma:1259`) y hệt DATA-02, không phải một khái niệm mới. Quyết định: **`organizationType='MANUFACTURER'`/`'DISTRIBUTOR'` trên `Organization` đã có, không tạo bảng `Manufacturer` riêng** — tránh đúng cái bẫy doc tự cảnh báo ("Do not duplicate DATA-02 organizations... do not create duplicate company identities").

`OrganizationProductRelation` (mới) thay cho `organization_product_relations` của doc — FK tới `Organization` đã có, không phải bảng company mới.

## 3. Domain thật sự mới: Product/Spec/SparePart/Price/InstalledBase

Không có model nào trong XHub hiện tại biểu diễn "sản phẩm/thiết bị" — đây là domain mới hoàn toàn, cần bảng mới:
- `Product` (model/SKU, lifecycle CURRENT/LEGACY_SUPPORTED/DISCONTINUED/EOL/SUPERSEDED)
- `ProductSpec` (key-value, KHÔNG hardcode cột riêng theo category — đúng yêu cầu doc §5)
- `SparePart` + `SparePartCompatibility` (theo model/serial, không suy diễn theo brand)
- `ProductPriceObservation` (temporal, **không bao giờ** cột `products.price` tĩnh — đúng luật doc §7)
- `ProjectInstalledProduct` (FK `GlobalProject` — cùng giới hạn "chỉ Hapulico" như DATA-01/02)

## 4. Media/logo — field mới trên Organization + bảng lineage riêng

`Provider.logoAssetId` (`prisma/schema.prisma:975`, xây cho Geo hôm nay) là tiền lệ ĐẶT TÊN nhưng SAI MODEL (Provider ≠ Organization, xem audit DATA-02 §3). DATA-03 cần trên `Organization`:
- 1 field tham chiếu media hiện hành (`displayImageMediaId` hoặc tương tự) để UI list nhanh, VÀ
- 1 bảng `OrganizationMedia` riêng (lineage đầy đủ: nguồn, loại ảnh, source tier, hash, kích thước, trạng thái) — vì doc §2 (`04_SUPPLIER_MEDIA_LOGO_HANDOFF.md`) đòi nhiều field hơn 1 asset-id đơn thuần (source_website, image_type, content_hash, width/height...).

## 5. Tải logo — hợp lệ, không phải scraping

Toàn bộ 25+14 URL logo trong Excel là:
- `https://www.google.com/s2/favicons?sz=128&domain=...` — Google's public favicon proxy, miễn phí, không cần key, không vi phạm ToS trang đích (Google tự lấy favicon công khai);
- hoặc trực tiếp trang chủ chính thức của công ty (KONE, Schindler...).

Đây là tải **ảnh nhỏ, nguồn công khai, đã được user đồng ý tải** (không phải scraping HTML/nội dung có bản quyền) — khác hẳn việc scrape Google Maps hay nội dung bị cấm.

## 6. Không cần crawl thật để lấy dữ liệu chính

Giống DATA-02: Research Agent đã thu sẵn 25 supplier + 61 product + 7 giá + 5 installed-base — Claude chỉ tích hợp, không tự nghiên cứu lại từ đầu (doc §1/§13 nói rõ).

## Gate check (rút gọn cho Wave A)
- ✅ Nguồn xác nhận: Excel baseline đọc trực tiếp, mọi Product ID trong price observations đều tồn tại trong catalog (trừ 1 dòng cố ý không gắn product).
- ✅ Không tạo trùng Organization với DATA-01/DATA-02.
- ✅ Giá là observation temporal, không phải cột tĩnh.
- ⚠️ Installed-base graph: chỉ match được Hapulico cho tới Wave C.
- ⚠️ Media ingestion: chỉ tải ảnh nhỏ (favicon/logo) từ URL đã có sẵn trong Excel, không tự đi tìm URL mới.
