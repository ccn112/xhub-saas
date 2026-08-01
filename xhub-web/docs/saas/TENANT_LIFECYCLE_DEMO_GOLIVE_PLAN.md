# Tenant Lifecycle — Chế độ DEMO ↔ CHÍNH THỨC (Go-Live) + Reset Demo

> Yêu cầu chủ đầu tư (2026-07-30): tenant chính thức cần **2 chế độ** — (1) DEMO để trải nghiệm đúng nghiệp vụ/ngành, (2) CHÍNH THỨC (clear demo) với **checklist tuần tự + gợi ý nhân sự + template mẫu + hướng dẫn từng bước**. Và **nút Reset Demo**: sau khi người dùng làm loạn dữ liệu demo → khôi phục về trạng thái demo gốc để trải nghiệm lại.

## 1. Mô hình
- Thêm `Tenant.mode`: **`DEMO` | `LIVE`** (mặc định: tenant demo T002–010 = DEMO; khách T011+ tạo ra mặc định DEMO/trial → chuyển LIVE khi go-live). `SYSTEM-*`/T001 không áp.
- **Golden demo baseline** cho mỗi tenant DEMO: ngay sau provision, chụp 1 **baseline snapshot** (dùng chính `BackupService.createBackup` → gắn nhãn `kind=DEMO_BASELINE`, giữ bất biến, không bị retention xoá).

## 2. Reset Demo (khôi phục về trạng thái demo gốc)
- Endpoint `POST /api/platform/tenants/:id/reset-demo` (gated `platform.tenant.manage`; **chỉ cho tenant `mode=DEMO`** — chặn 409 nếu LIVE).
- Cơ chế: **restore in-place từ DEMO_BASELINE** vào chính tenant đó (mở rộng `BackupService.restore` thêm mode `reset-in-place` — CHỈ cho phép khi tenant DEMO + có confirm; giữ nguyên nguyên tắc "không ghi đè tenant LIVE"). Xoá dữ liệu nghiệp vụ hiện tại của tenant → nạp lại baseline. Audit + MUST_NOT_LEAK (chỉ trong tenant đó).
- UI: nút **"Reset về demo"** ở Platform Console (và có thể ở tenant admin cho DEMO) + confirm.

## 3. Go-Live (DEMO → CHÍNH THỨC)
- **GoLiveChecklist template** theo blueprint/ngành (catalog versioned như Blueprint): danh sách bước tuần tự, mỗi bước có `{ order, key, title, guidance (hướng dẫn), suggestedRole (gợi ý nhân sự làm), templateRef? (template mẫu: file/biểu mẫu), required }`. Ví dụ: chuẩn hoá cơ cấu tổ chức → nạp nhân sự thật → cấu hình vai trò/quyền → thiết lập quy trình duyệt → nhập danh mục/dữ liệu gốc → cấu hình backup → nghiệm thu UAT → **xác nhận xoá dữ liệu demo** → kích hoạt LIVE.
- **Per-tenant progress**: `TenantGoLive` (tenantId, checklistCode/version, steps[] trạng thái done/assignee/note, status IN_PROGRESS|READY|LIVE).
- **Clear demo data + chuyển LIVE**: `POST /api/platform/tenants/:id/go-live` — chặn nếu bước `required` chưa xong; **xoá toàn bộ dữ liệu nghiệp vụ demo** (giữ cơ cấu tổ chức/người dùng thật đã nhập ở bước checklist, hoặc theo lựa chọn "xoá sạch để bắt đầu trắng"); đặt `mode=LIVE`; snapshot backup "go-live baseline"; audit. Không thể quay lại DEMO (một chiều) — hoặc cho phép nhưng cảnh báo.
- **Templates mẫu**: đính kèm ở mỗi bước (biểu mẫu cơ cấu tổ chức, danh sách nhân sự, ma trận quyền, danh mục…) — lưu như RecordDocument/template hoặc file mẫu tải về.

## 4. UI (Platform Console + Tenant onboarding)
- Trang **Go-Live** cho 1 tenant: checklist tuần tự (tick từng bước, gán người phụ trách, mở template/hướng dẫn), thanh tiến độ, nút "Chuyển sang chính thức (xoá dữ liệu demo)" mở khi đủ điều kiện.
- Nút **"Reset về demo"** cho tenant DEMO.
- Badge chế độ DEMO/LIVE ở danh sách tenant.

## 5. Guardrails
- Reset-in-place + clear-demo là thao tác phá huỷ → **confirm 2 lớp + chỉ platform operator + audit + snapshot trước khi xoá**. Không cho reset/clear tenant LIVE (trừ go-live một lần). MUST_NOT_LEAK giữ nguyên. Không plaintext secret trong template.

## 6. Thứ tự build (sau T011 readiness để tránh đụng registry/platform)
1. `Tenant.mode` + DEMO_BASELINE snapshot khi provision (sửa provisioner + backup nhãn bất biến).
2. Reset-demo (restore in-place guarded) + UI nút.
3. GoLiveChecklist catalog + TenantGoLive progress + templates.
4. Go-live (clear demo + LIVE) + UI wizard.
5. Smoke: DEMO tenant → làm loạn data → reset-demo → về baseline; go-live checklist đủ điều kiện → clear → LIVE + không quay lại; guardrail chặn LIVE. + regression.
</content>
