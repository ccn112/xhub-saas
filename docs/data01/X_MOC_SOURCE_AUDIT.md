# DATA-01 — MOC/SXD Source Audit

**Ngày:** 2026-08-08
**Nguồn anchor:** `https://moc.gov.vn/vn/chuyen-muc/1308/danh-sach-don-vi-du-dieu-kien-thuc-hien-quan-ly-van-hanh-nha-chung-cu.aspx`
**Method:** đọc trực tiếp workbook `01_DATA01_MASTER_PRODUCTION.xlsx` (baseline chính thức) + `curl` thật vào trang sống (read-only, không crawl toàn bộ).

## 1. Baseline workbook — số liệu thật, không giả định

16 sheet, đã đọc qua `pandas`/`openpyxl`:

| Sheet | Rows | Ghi chú |
|---|---|---|
| `01_Official Registry` | 206 | mỗi dòng 1 official event (mostly `QUALIFIED`) |
| `02_Company Master` | 205 | 1 dòng/tổ chức, `Qualification status`: 193 `QUALIFIED` · 10 `UPDATED` · 2 `REVOKED` |
| `03_Enriched Accounts` | 12 | full contact/portfolio/lead-score — 26 cột |
| `05_Sales Queue` | 205 | mirror Company Master + CRM stage/owner/next action |
| `10_License Intelligence` | 205 | qualification state + T-365..T-30 reminder columns |
| `14_Production Enrichment` | 205 | 34 cột — full field-level enrichment status per org |

`Enrichment` value_counts trên `02_Company Master`: **193 "Chưa enrich" · 6 "Enrich một phần" · 6 "Đã enrich"** — khớp đúng con số "12 account đã deep-enrich" trong `06_BASELINE...md`.

Sample record (`02_Company Master`, dòng đầu): `Organization Seed ID=OPR-0187`, `Tên pháp lý="Công ty Cổ phần Đầu tư Xây dựng An Điền"`, `Latest document=7944/SXD-QLN&CS`, `Confidence=0.95`, `Secure identity ingest="Chưa xác định"` — **xác nhận: baseline này KHÔNG chứa raw CCCD/CMND nào** — cột `Secure identity ingest` toàn bộ ở trạng thái "Chưa xác định" (chưa xác định), không có giá trị định danh thật.

## 2. Trang sống — đã kiểm tra thật, không đoán

- `curl` trực tiếp (không cần JS render) → **HTTP 200**, HTML tĩnh, đủ nội dung để parse (SharePoint/ASPX legacy site).
- `robots.txt` → 404 (SharePoint tự redirect sang trang lỗi) — **không có khai báo hạn chế crawl nào**.
- Phân trang: query param đơn giản `?page=N`, hiện tại trang cuối là **28** (đúng như `06_BASELINE...md` ghi chú, nhưng đúng như doc cảnh báo — số này SẼ đổi, không hardcode).
- Cấu trúc 1 dòng listing (đọc trực tiếp từ HTML page 1, dòng 355):
  ```html
  <a href='http://moc.gov.vn/vn/tin-tuc/1308/95191/so-xay-dung-thanh-pho-ho-chi-minh-thong-bao-cong-ty-co-phan-dau-tu-quan-ly-va-khai-thac-bat-dong-san-long-duong-group-du-dieu-kien-quan-ly-van-hanh--.aspx'>Sở Xây dựng thành phố Hồ Chí Minh thông báo Công ty Cổ phần Đầu tư quản lý và Khai thác bất động sản Long Dương Group đủ điều kiện quản lý vận hành nhà chung cư</a><span class='news_datetime'>(30/06/2026)</span>
  ```
  Template nhất quán: `"{Cơ quan} thông báo {Tên công ty} đủ điều kiện quản lý vận hành nhà chung cư"` + `href` chứa notice ID (`95191`) + `<span class='news_datetime'>` là ngày ĐĂNG (khác ngày hiệu lực — ví dụ record này đăng 30/06/2026 nhưng `Ngày hiệu lực` trong Excel là 2026-06-25, lệch 5 ngày, hai field khác nhau, không được lẫn).
- **Xác nhận trùng khớp 100%** giữa page 1 sống hôm nay và top-of-list trong Excel: URL notice `95191` (Long Dương Group) xuất hiện y hệt ở cả live page 1 VÀ ở `03_Enriched Accounts` dòng đầu ("Nguồn chính thức"). Baseline được thu cùng ngày (2026-08-08) nên **page 1 hôm nay = không có tổ chức MỚI nào so với baseline** — đây là kết quả mong đợi, không phải lỗi; nó xác nhận cơ chế idempotent (crawl lại → 100% khớp record đã có, 0 tổ chức mới, 0 duplicate mồ côi).

## 3. Field thực tế lấy được từ LISTING (không cần mở PDF/detail)

- Tên công ty (parse từ title theo template trên).
- Cơ quan (Sở Xây dựng tỉnh/TP nào — cũng từ title).
- Ngày đăng thông báo (`news_datetime`).
- Notice ID + URL detail (từ `href`).

**Không có trong listing** (cần mở detail/PDF — ngoài phạm vi Wave A): số văn bản chính xác, MST, địa chỉ pháp lý, người đại diện, điện thoại/email. Baseline Excel đã có các field này cho 205 org (chắc chắn do người vận hành đã mở từng detail/PDF trước đó) — Wave A **import từ Excel**, không tự mở lại 205 PDF.

## 4. Kết luận cho Wave A

- Seed 205 tổ chức + 206 event từ Excel (nguồn đã verify, không cần crawl lại).
- Crawl thật CHỈ page 1 (POC) để chứng minh cơ chế `OrgSourceRecord` + dedupe hoạt động đúng — không kỳ vọng tìm tổ chức mới hôm nay.
- Không mở PDF, không parse MST/địa chỉ pháp lý từ trang sống trong Wave A — dữ liệu đó lấy từ Excel (đã có nguồn URL evidence sẵn cho 12 account enriched).
