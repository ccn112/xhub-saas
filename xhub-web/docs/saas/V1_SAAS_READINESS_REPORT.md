# Báo cáo sẵn sàng SaaS v1.0 (T011 Exit Gate)

> Tài liệu tổng hợp tiêu chí thoát (exit criteria) cho phiên bản SaaS v1.0. **Trạng thái hiện tại được lấy trực tiếp** từ endpoint `GET /api/platform/readiness` và hiển thị realtime tại màn hình **Platform Console → Sẵn sàng v1.0** (`/platform/readiness`). Tài liệu này mô tả ý nghĩa từng tiêu chí; con số PASS/FAIL sống động nằm ở màn hình.

## 1. Bối cảnh

v1.0 là mốc "sẵn sàng đón khách hàng thật". Hệ sinh thái đã seed gồm **T001** (chủ nền tảng X-TECH), **T002–T010** (demo ngành) — tất cả ACTIVE — và mở đường cho **T011+** (khách hàng trả phí). Cổng thoát chạy một checklist đọc registry SHARED + kiểm thử cách ly RLS trên từng tenant, và KHÔNG bao giờ lộ nội dung nghiệp vụ tenant (chỉ đếm số/cờ).

Endpoint trả về: `ok` (tổng thể), `summary` (activeTenants / totalChecks / passed / failed), `exitCriteria` (10 điểm cuộn lên), và `checks` (chi tiết per-tenant + platform).

## 2. Tiêu chí thoát v1.0

| # | Tiêu chí | Ý nghĩa | Check nguồn |
|---|----------|---------|-------------|
| 1 | **Onboarding ≥ 11 + bất biến/duy nhất** | Bộ cấp số khách hàng luôn trả `tenantNo ≥ 11` (T001–T010 giữ chỗ); tenantNo duy nhất, không tái sử dụng | `allocator-min`, `tenantno-unique` |
| 2 | **Plan/entitlement được thực thi** | Mỗi tenant ACTIVE có `planId` giải được về một gói trong catalog; entitlement là điểm gate app/quota/feature duy nhất | `plan` (mỗi tenant) |
| 3 | **Cách ly xuyên tenant** | Dưới ngữ cảnh RLS của một tenant, dữ liệu tenant khác PHẢI vô hình (MUST_NOT_LEAK) | `isolation` (mỗi tenant) |
| 4 | **Backup/restore theo từng tenant** | Mỗi tenant có lịch backup riêng + ≥ 1 job đã chạy; thư mục lưu + retention riêng | `backup` (mỗi tenant) |
| 5 | **Không lưu mật khẩu dạng thô** | Mọi credential lưu dạng hash argon2 (`$argon2…`), không plaintext | `secrets` (mỗi tenant) |
| 10 | **Tách quyền nền tảng vs tenant** | Mọi policy cấp nền tảng (PLT_) chỉ cấp mã `platform.*` — không `*`, không mã nghiệp vụ tenant | `platform-permission-separation` |
| 0 | **N tenant ACTIVE đã xác minh** | Có ≥ 1 (mục tiêu 10) tenant ACTIVE vượt toàn bộ check trên | tổng hợp |

## 3. Trạng thái hiện tại

Snapshot gần nhất khi soạn tài liệu (nguồn: `GET /api/platform/readiness`):

- **Tổng thể: SẴN SÀNG (`ok = true`).**
- **10** tenant ACTIVE (T001–T010) được xác minh.
- **43 / 43** kiểm tra PASS, **0** FAIL.
- Toàn bộ 7 nhóm tiêu chí thoát: **PASS**.

Vì con số thay đổi theo dữ liệu, luôn xem trạng thái sống tại `/platform/readiness` (màn hình hiển thị overall status, 4 stat card, bảng tiêu chí thoát, và checklist tách nhóm *platform* vs *per-tenant*).

## 4. Liên quan

- Kế hoạch: `T011_CUSTOMER_READINESS_PLAN.md`
- Quyền: `PLATFORM_VS_TENANT_PERMISSION_PLAN.md`
- Backup: Platform Console → Backup định kỳ (`/platform/backups`)
- Gói dịch vụ: Platform Console → Gói dịch vụ (`/platform/plans`)
- Onboarding: Platform Console → Sổ đăng ký tenant → "Đăng ký khách hàng mới" (`POST /api/platform/onboard`)
