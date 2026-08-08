# Wave A Manual Test Checklist — Geo/Provider Master + DATA-01 (2026-08-08)

Server đã chạy tại `http://localhost:4000` (all-in-one, `npx nest start --watch=false`, PID xem `ps aux | grep "nest start"`). Mọi URL dưới đây **mở thẳng trên trình duyệt** (hiện JSON) hoặc `curl` trên terminal. ID thật đã điền sẵn, không cần tra DB.

Tick `[x]` khi test xong, ghi PASS/FAIL + ghi chú vào cột cuối nếu cần. Dừng server khi xong: `pkill -f "nest start --watch=false"`.

---

## A. Geo/Provider Catalog (Hapulico golden slice)

| # | Bước | URL | Kỳ vọng | Kết quả |
|---|---|---|---|---|
| A1 | Danh sách dự án | http://localhost:4000/api/catalog/projects | `items[]` có Hapulico Complex (`code: "BDS-PJ158"`) | [ ] |
| A2 | Chi tiết dự án | http://localhost:4000/api/catalog/projects/BDS-PJ158 | Đủ `name`, `latitude/longitude`, `projectType`, `developerName` | [ ] |
| A3 | Tiện ích quanh dự án (800m) | http://localhost:4000/api/catalog/projects/BDS-PJ158/nearby?radius_m=800 | `items[]` có POI thật (Joyce Barber Home, TH true mart, TPBank...), mỗi item có `distanceM`, `zone` (gate/walkable/...), **KHÔNG** có field `sourcePayload` | [ ] |
| A4 | Tiện ích bán kính 3km | http://localhost:4000/api/catalog/projects/BDS-PJ158/nearby?radius_m=3000 | Nhiều item hơn A3, `radiusM: 3000` | [ ] |
| A5 | Danh sách provider của dự án | http://localhost:4000/api/catalog/projects/BDS-PJ158/providers | Giống shape A3 | [ ] |
| A6 | Chi tiết 1 provider (VietinBank ATM) | http://localhost:4000/api/providers/71527fb6-a8e0-4b7c-a778-4daff75bc11b | `name: "VietinBank"`, `verificationStatus: "DISCOVERED"` | [ ] |
| A7 | Discovery theo toạ độ tự do | http://localhost:4000/api/discovery/nearby?lat=21.0004883&lng=105.8071594&radius_m=1000 | Cùng dữ liệu khu vực Hapulico, không cần biết `projectId` | [ ] |
| A8 | Tìm kiếm theo tên | http://localhost:4000/api/discovery/search?q=coffee | Ra "The Coffee House" (hoặc quán cà phê khác gần đó) | [ ] |
| A9 | Dự án không tồn tại → 404 | http://localhost:4000/api/catalog/projects/khong-ton-tai | HTTP 404 (không phải 200 rỗng) | [ ] |

### A10 — Proxy thật từ X2 (cần chạy X2 backend riêng)
```bash
cd /Users/vanchien/Documents/CCN/Code/x2/x2backend && php artisan serve --port=8000
```
Mở: http://localhost:8000/api/v1/public/projects/BDS-PJ158/nearby?radius_m=800
Kỳ vọng: JSON field `snake_case` (`place_id`, `distance_m`...), dữ liệu khớp A3 nhưng đã re-shape qua X2. `[ ]`

---

## B. DATA-01 Organization Master

| # | Bước | URL | Kỳ vọng | Kết quả |
|---|---|---|---|---|
| B1 | Danh sách tổ chức | http://localhost:4000/api/mdm/organizations?limit=5 | 5 tổ chức, có `qualificationStatus` mỗi dòng | [ ] |
| B2 | Tìm theo tên | http://localhost:4000/api/mdm/organizations?q=long%20duong | Ra "Long Dương Group" | [ ] |
| B3 | Chi tiết tổ chức đã enrich đầy đủ | http://localhost:4000/api/mdm/organizations/3398adac-a5a3-4ba8-bd8a-7fb17437de8e | `taxCode: "3702712525"`, có `companyPhone`/`website`, `qualification.status: "QUALIFIED"`, `representatives[]` có "Vũ Đăng Khuê" | [ ] |
| B4 | Lịch sử qualification | http://localhost:4000/api/mdm/organizations/3398adac-a5a3-4ba8-bd8a-7fb17437de8e/qualifications | `current.status: "QUALIFIED"`, `events[]` không rỗng | [ ] |
| B5 | Dự án liên kết (chưa có, đúng) | http://localhost:4000/api/mdm/organizations/3398adac-a5a3-4ba8-bd8a-7fb17437de8e/projects | `items: []` — **đúng**, Wave C (6.000 dự án) chưa chạy nên chưa match được | [ ] |
| B6 | Tổ chức bị THU HỒI — không được hiện "đang qualified" | http://localhost:4000/api/mdm/organizations/3fa23524-fb25-4218-8226-bac7613d13f7 | Xem `qualification` (gọi thêm .../qualifications) → `status` phải là `"REVOKED"`, **không bao giờ** `"QUALIFIED"` | [ ] |
| B7 | Tổ chức không tồn tại → 404 | http://localhost:4000/api/mdm/organizations/khong-ton-tai | HTTP 404 | [ ] |

---

## C. Kiểm tra ở tầng DB (tuỳ chọn, cho người quen SQL)

```bash
cd /Users/vanchien/Documents/CCN/Code/xhub-saas/xhub-api
DB_PW=$(grep -o 'xhub:[^@]*@' .env | sed 's/xhub://;s/@//')
PGPASSWORD="$DB_PW" psql -h localhost -U xhub -d xhub -c "SELECT status, count(*) FROM \"OrganizationQualification\" GROUP BY status;"
# Kỳ vọng: QUALIFIED=193, UPDATED=10, REVOKED=2 — khớp Excel gốc
```

---

## Ghi chú
- Toàn bộ script tự động (`npm run test:geo-hapulico`, `npm run test:data01`) đã PASS trước khi giao checklist này — đây là bước bạn tự mắt kiểm tra thêm, không phải lần test đầu tiên.
- Nếu server bị tắt, khởi động lại: `cd xhub-saas/xhub-api && npx nest start --watch=false`.
