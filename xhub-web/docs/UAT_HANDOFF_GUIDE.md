# Hướng dẫn kiểm thử (UAT) XHub — dành cho người test mới

> Tài liệu này dùng để bàn giao trực tiếp cho một người chưa từng thấy hệ thống. Không cần biết lập trình. Làm theo đúng thứ tự.

---

## 1. XHub là gì?

**XHub** là cổng làm việc hợp nhất của X-TECH: thay vì mở nhiều phần mềm rời rạc, bạn có **một nơi duy nhất** để xem tình hình điều hành, xử lý công việc/phê duyệt, trao đổi với đồng nghiệp và khách hàng (**X.Space**), chạy các quy trình nghiệp vụ như mua sắm/thanh toán/tuyển dụng/ticket (**X.Office**), và tra cứu dữ liệu doanh nghiệp (khách hàng, tài liệu, báo cáo). Bản đang test là bản demo nội bộ dùng dữ liệu mẫu cố định (không phải dữ liệu khách hàng thật).

## 2. Cách truy cập

1. Xin người phụ trách (dev) xác nhận hai máy chủ đang chạy:
   - Web (giao diện bạn sẽ mở): thường ở `http://localhost:3000` (đôi khi `3001` — hỏi lại nếu không chắc).
   - API (chạy nền, bạn không cần mở): `http://localhost:4000`.
2. Mở trình duyệt (Chrome/Edge/Firefox) tới địa chỉ web ở trên. Bạn sẽ thấy trang **Đăng nhập XHub**.
3. Đây là **bản demo**: hầu hết tài khoản đăng nhập **không cần mật khẩu** — chỉ cần gõ email (hoặc bấm thẳng tên trong khung "Chọn nhanh (demo, không mật khẩu)" ngay dưới form) rồi bấm **Đăng nhập**.

## 3. Tài khoản test (dùng đúng bảng này, đừng tự đoán)

| Nhãn dùng trong checklist | Tên | Email / userId | Mật khẩu | Ghi chú |
|---|---|---|---|---|
| **[ADMIN] / [PLATFORM]** | Nguyễn Hoài Nam (Giám đốc Công nghệ) | `nam.nguyen@xtech.com.vn` | để trống | Tài khoản có **mọi quyền**. Dùng cho mọi dòng có nhãn `[ADMIN]` hoặc `[PLATFORM]`, và cho các màn không ghi nhãn vai trò gì. |
| **Nhân viên thường** | Trần Thu Hà (Trưởng nhóm Kinh doanh) | `ha.tran@xtech.com.vn` | để trống | Tài khoản KHÔNG có quyền quản trị. Dùng để xác nhận khu **Quản trị** (`/admin/*`) và **Platform Console** (`/platform/*`) **không hiện ra** với người dùng thường. |
| **T002 (đa tenant)** | Admin tenant "Chủ đầu tư Bất động sản Demo" | userId `tenant-realestate-demo-admin` | Do dev cấp — xem ghi chú | Tài khoản này **không** nằm trong danh sách "Chọn nhanh (demo)" — phải nhập email/userId + mật khẩu do dev cung cấp trực tiếp (mật khẩu được sinh ngẫu nhiên mỗi lần dev chạy lệnh cấp phát, không cố định). Nếu chưa có mật khẩu, **bỏ qua nhóm "Đa tenant" (U52–U54)** và ghi "N/A — chưa có tài khoản T002". |

> Không tự chế thêm tài khoản, không đoán mật khẩu. Nếu một tài khoản không đăng nhập được, ghi lại thông báo lỗi chính xác và báo cho dev.

## 4. Ý nghĩa các nhãn trong checklist

- **[ADMIN]** — chỉ tài khoản quản trị tenant (dùng tài khoản Nguyễn Hoài Nam ở trên) mới thấy/thao tác được.
- **[PLATFORM]** — chỉ tài khoản vận hành nền tảng (platform-operator, cũng dùng tài khoản Nguyễn Hoài Nam) mới thấy/thao tác được.
- **[ENFORCE]** — màn/luồng này chỉ thể hiện đúng khi máy chủ API đang **bật** chế độ kiểm soát quyền nghiêm ngặt (`AUTH_ENFORCE=true`). Ở môi trường demo mặc định, chế độ này **đang tắt** — khi gặp dòng `[ENFORCE]`, bạn **không cần** coi là lỗi nếu không thấy hành vi mô tả; hãy để trạng thái **"Chưa test"** và ghi chú **"N/A demo mode"**. Đừng tick FAIL cho các dòng này trừ khi dev xác nhận `AUTH_ENFORCE=true` đang bật.

## 5. Cách dùng checklist tương tác (khuyến nghị — nhanh hơn bản in này)

1. Sau khi đăng nhập, vào **Doanh nghiệp → Tài liệu**, hoặc gõ thẳng đường dẫn `/docs`, rồi chọn tab **"Kiểm thử"**.
2. Trang này có sẵn phần **"Bắt đầu ở đây"** (mục 3–4 ở trên được lặp lại tại đó) và toàn bộ checklist bên dưới, chia theo nhóm.
3. Với mỗi dòng: bấm **"Mở màn ↗"** để mở đúng màn cần test ở tab mới → làm theo cột **Bước** → so kết quả thật với cột **Kỳ vọng** → bấm nút **PASS** hoặc **FAIL** ở bên phải dòng đó (có thể gõ Ghi chú nếu FAIL).
4. Kết quả tự lưu (badge góc bảng: "Đã lưu máy chủ" = đã đồng bộ; "Lưu cục bộ (offline)" = máy chủ tạm không phản hồi, dữ liệu vẫn giữ trên máy bạn, thử lại sau).
5. Khi xong, bấm **"Sao chép kết quả"** — một bảng Markdown được chép vào clipboard. Dán nội dung đó vào email/chat gửi cho người phụ trách (xem mục 7).

## 6. Checklist đầy đủ (bản in — dùng nếu không vào được `/docs/test`)

> Tick `[x]` khi PASS. Nếu FAIL, để `[ ]` và ghi rõ lỗi vào dòng "Ghi chú" ngay dưới mục đó.

### 6a. Điều hướng & UI
- [ ] **U1** — Xem icon rail bên trái (`/home/me`) → Đúng 5 workspace: Trang chủ · Công việc · X.Space · X.Office · Doanh nghiệp (không có mục "Thiết lập" thừa).
  - Ghi chú: ______
- [ ] **U2** — Bấm từng workspace trên rail (`/home/me`) → Panel "prime" con hiện đúng các màn của workspace đang chọn.
  - Ghi chú: ______
- [ ] **U3** — Thu gọn menu (nút "Thu gọn / Mở menu") → Rail thu gọn thành header ngang có icon; mở lại về panel dọc; icon back chevron đúng.
  - Ghi chú: ______
- [ ] **U4** — Thu nhỏ cửa sổ / mở trên mobile → hamburger → Hiện drawer hamburger; liệt kê menu theo workspace đang chọn.
  - Ghi chú: ______
- [ ] **U5** — Mở Sơ đồ đơn vị (`/admin/organization`) → nút toàn màn hình → Org-chart phủ luôn rail trái; thoát fullscreen trả lại layout.
  - Ghi chú: ______
- [ ] **U6** — Chuyển sáng / tối (theme toggle) → Toàn bộ màu nền/chữ đổi đồng bộ, không mảng trắng/đen lệch tông.
  - Ghi chú: ______
- [ ] **U7** — Mở `/docs` xem các tab → 6 tab: Phát triển · Hướng dẫn · Nghiệp vụ · SaaS · Backlog · Kiểm thử; mỗi tab có markdown + mục lục.
  - Ghi chú: ______

### 6b. Xác thực
- [ ] **U8** — Mở `/login` đăng nhập → Form hiện ra; đúng thì vào app, sai thì báo lỗi.
  - Ghi chú: ______
- [ ] **U9** — [ENFORCE] Luồng mời → kích hoạt (`/activate`) → Link mời mở `/activate`; đặt mật khẩu → tài khoản active, đăng nhập được.
  - Ghi chú: ______
- [ ] **U10** — [ENFORCE] Quên mật khẩu `/forgot` → `/reset` → Nhập email nhận link; đặt mật khẩu mới; đăng nhập bằng mật khẩu mới.
  - Ghi chú: ______
- [ ] **U11** — [ADMIN][ENFORCE] Thu hồi phiên khi treo tài khoản (`/admin/users`) → Suspend user → phiên hiện tại của user đó bị vô hiệu.
  - Ghi chú: ______
- [ ] **U12** — Chọn tenant (`/select-tenant`) → User đa tenant thấy danh sách tenant; chọn 1 → vào đúng workspace tenant đó.
  - Ghi chú: ______

### 6c. Quản trị & Tổ chức
- [ ] **U13** — [ADMIN] `/admin` tổng quan → Chip "Control Plane trực tiếp"; số liệu người dùng/đơn vị/vị trí/xung đột/kết nối là số thật.
  - Ghi chú: ______
- [ ] **U14** — [ADMIN] `/admin/users` danh sách + mời → Chip live; chức danh/đơn vị/vai trò resolve thật; nút mời mở drawer.
  - Ghi chú: ______
- [ ] **U15** — [ADMIN] `/admin/organization` Sơ đồ đơn vị → Chip "Dữ liệu trực tiếp (/api/identity)"; cây đơn vị + trưởng đơn vị thật.
  - Ghi chú: ______
- [ ] **U16** — [ADMIN] Sơ đồ nhân sự (avatar/email/sđt) → Mỗi node hiện avatar, email, số điện thoại thật.
  - Ghi chú: ______
- [ ] **U17** — [ADMIN] Cấu hình node đơn vị → Đổi tên / gán trưởng / thêm con / di chuyển / xoá — lưu được, cây cập nhật.
  - Ghi chú: ______
- [ ] **U18** — [ADMIN] In / Xuất PDF sơ đồ → Tạo file sơ đồ đúng bố cục.
  - Ghi chú: ______
- [ ] **U19** — [ADMIN] `/admin/positions` vị trí + kiêm nhiệm → Timeline vị trí; hiển thị acting/kiêm nhiệm đúng.
  - Ghi chú: ______
- [ ] **U20** — [ADMIN] `/admin/roles` vai trò + ma trận quyền → "test-as-user" xem quyền hiệu lực của 1 user.
  - Ghi chú: ______
- [ ] **U21** — [ADMIN] `/admin/data-scopes` phạm vi dữ liệu → Cấu hình data-scope hiển thị và lưu đúng.
  - Ghi chú: ______
- [ ] **U22** — [ADMIN] `/admin/delegations` uỷ quyền → Guardrail SELF_DELEGATION gắn cờ khi tự uỷ quyền cho mình.
  - Ghi chú: ______
- [ ] **U23** — [ADMIN] `/admin/backups` → "+ Tạo bản sao lưu" → Drawer submit → gói mới xuất hiện, Checksum PASS, dung lượng hiển thị.
  - Ghi chú: ______
- [ ] **U24** — [ADMIN] `/admin/restores` phục hồi → Chọn gói → mô phỏng khôi phục hiển thị trạng thái.
  - Ghi chú: ______
- [ ] **U25** — [ADMIN] `/admin/audit` nhật ký kiểm toán → Log audit các thao tác quản trị; lọc/tra cứu được.
  - Ghi chú: ______
- [ ] **U26** — [ADMIN] `/admin/settings/tenant` provisioning → Panel live; toggle Bật/Tắt app; nút "Đối soát" → consistent.
  - Ghi chú: ______

### 6d. Công việc (Work v2)

**Nguyên tắc quản trị:** nhóm này kiểm tra kỷ luật quản lý dự án theo chuẩn PMI, không chỉ giao diện đẹp. Gantt có **baseline bất biến** (kế hoạch gốc) song song với thực tế để đo lệch tiến độ thật; phụ thuộc FS/SS/FF/SF là cơ sở của **Critical Path Method** — việc trên đường găng trễ thì cả dự án trễ, việc ngoài đường găng có thời gian dự trữ (slack). Gantt phối hợp (chia sẻ SUMMARY) áp dụng nguyên tắc **"cần biết"**: người ngoài nhóm chỉ thấy tiến độ tổng hợp, không thấy chi tiết nội bộ. Kanban và Reports phải hỗ trợ **nhiều chiều phân tích** (tag/dimension), không chỉ một trục trạng thái — vì quản trị thực tế cần nhìn cùng một backlog từ nhiều góc.
- [ ] **U56** — `/work/projects` → mở 1 dự án → Danh sách ExecutionProject; chi tiết hiện WBS/tiến độ/baseline.
  - Ghi chú: ______
- [ ] **U57** — Gantt (nút "Gantt" trên chi tiết dự án) → Timeline theo ngày; kế hoạch vs thực tế; đường phụ thuộc FS/SS/FF/SF; mốc; cây WBS thu/mở.
  - Ghi chú: ______
- [ ] **U58** — Gantt — kéo/resize 1 thanh việc → Ngày cập nhật ngay; nếu phá vỡ phụ thuộc FS → báo lỗi, tự rollback.
  - Ghi chú: ______
- [ ] **U59** — Gantt phối hợp — mở link chia sẻ dạng SUMMARY → Chỉ thấy thanh việc CHA, không thấy việc con/mô tả chi tiết; có badge "Chia sẻ phối hợp".
  - Ghi chú: ______
- [ ] **U60** — Bảng Kanban `/work/board` → Kéo thẻ đổi cột → lưu server (rollback nếu trạng thái không hợp lệ); gom nhóm theo tag/chiều được.
  - Ghi chú: ______
- [ ] **U61** — Lịch `/work/calendar` → Lưới tháng hiện việc theo hạn + milestone; bấm việc mở chi tiết.
  - Ghi chú: ______
- [ ] **U62** — Danh mục dự án `/work/portfolio` → Thẻ KPI (đang chạy/đỏ/quá hạn/nghẽn); biểu đồ sức khỏe; bấm vào bảng chi tiết.
  - Ghi chú: ______
- [ ] **U63** — Thống kê đa chiều `/work/reports` → Chọn trục hàng × cột × chỉ số → bảng pivot + biểu đồ cột đúng số.
  - Ghi chú: ______

### 6e. Quản trị (Management OS)

**Nguyên tắc quản trị:** nhóm này kiểm tra tầng quản trị điều hành, tách bạch với thực thi dự án ở 6d. Scorecard/OKR phải theo nguyên tắc **quản trị theo ngoại lệ** — không được có một điểm số gộp che một KPI đang đỏ. KPI như ACT-CLOSE phải **tính từ dữ liệu Work thật**, không nhập tay, để đảm bảo số liệu đáng tin (mỗi chỉ số có chủ, công thức, nguồn rõ ràng). Review phải có pre-read + ngoại lệ + quyết định + hành động (không phải họp báo cáo suông). Quyết định theo mô hình **RAPID** (Recommend/Agree/Perform/Input/Decide) — vai trò rõ ràng, có bằng chứng, có hạn xử lý.
- [ ] **U64** — `/manage` trang chủ điều hành → Thẻ sức khỏe: mục tiêu đúng tiến độ, KPI đỏ, quyết định mở, action quá hạn — số thật.
  - Ghi chú: ______
- [ ] **U65** — `/manage/objectives` mục tiêu chiến lược → 4 mục tiêu; mở chi tiết 1 mục tiêu thấy chỉ số liên kết.
  - Ghi chú: ______
- [ ] **U66** — `/manage/metrics` — KPI ACT-CLOSE → Biểu đồ tính TỪ dữ liệu Work thật (không nhập tay), khớp số việc quá hạn thực tế.
  - Ghi chú: ______
- [ ] **U67** — `/manage/reviews` — mở 1 review tháng → Pre-read: snapshot + ngoại lệ (RAG) → quyết định RAPID → action; bấm action sang đúng việc thật.
  - Ghi chú: ______
- [ ] **U68** — Đóng 1 review → Trạng thái chuyển "Follow-up"/"Đã đóng"; follow-up được ghi nhận.
  - Ghi chú: ______
- [ ] **U69** — `/manage/decisions` → Danh sách quyết định RAPID (Recommend/Agree/Decide/Input/Perform); có độ tuổi (aging) của quyết định chưa xử lý.
  - Ghi chú: ______

### 6f. X.Office
- [ ] **U27** — `/office/requests` tạo→submit→duyệt → Trạng thái chuyển đúng qua các bước.
  - Ghi chú: ______
- [ ] **U28** — Yêu cầu — comment + đính kèm + execute/evidence → Bình luận & tệp; bước execute ghi evidence.
  - Ghi chú: ______
- [ ] **U29** — `/office/my-requests` → Chỉ hiện yêu cầu của mình; đồng bộ Request Center.
  - Ghi chú: ______
- [ ] **U30** — `/office/directives` issue→acknowledge→accept → Timeline ghi nhận từng bước.
  - Ghi chú: ______
- [ ] **U31** — `/office/service-desk` ticket → Tạo→assign→resolve→CSAT; SLA/trạng thái cập nhật.
  - Ghi chú: ______
- [ ] **U32** — `/office/bookings` tạo→duyệt→check-in → Đặt trùng khung giờ trả xung đột (409).
  - Ghi chú: ______
- [ ] **U33** — `/office/announcements` publish→read→ack→remind → Báo cáo tỷ lệ + nhắc lại.
  - Ghi chú: ______
- [ ] **U34** — `/inbox` hộp việc → Work-item gom về; mở item sang đúng màn xử lý.
  - Ghi chú: ______
- [ ] **U35** — `/approvals` hàng chờ duyệt → Approve/reject cập nhật nguồn.
  - Ghi chú: ______
- [ ] **U36** — `/office/workflows` quy trình → Mở builder/form/versions hiển thị đúng.
  - Ghi chú: ______
- [ ] **U37** — `/office/monitor` giám sát → Bảng giám sát instance/quy trình có số liệu.
  - Ghi chú: ______

### 6g. Tài liệu
- [ ] **U38** — Mở `/documents` → Chip "Kho tài liệu trực tiếp"; Dung lượng + Phiên bản là số thật.
  - Ghi chú: ______
- [ ] **U39** — Mở 1 tài liệu — lịch sử phiên bản → Timeline bất biến; size/mime/tác giả/sha256.
  - Ghi chú: ______
- [ ] **U40** — "+ Tải tài liệu" → Drawer upload → tạo tài liệu mới thật, thấy trong danh sách.
  - Ghi chú: ______
- [ ] **U41** — "Phiên bản mới" + "Tải nội dung" → Version +1 (bản cũ giữ nguyên); tải đúng nội dung.
  - Ghi chú: ______

### 6h. X.Space
- [ ] **U42** — `/space/home` + kênh → Danh sách kênh; mở kênh xem overview/threads/lists.
  - Ghi chú: ______
- [ ] **U43** — Nhắn trực tiếp (DM) → Gửi/nhận tin đúng luồng.
  - Ghi chú: ______
- [ ] **U44** — `/customers` khách hàng 360 → Mở hồ sơ 360 (thông tin + hoạt động) đầy đủ.
  - Ghi chú: ______

### 6i. Platform Console
- [ ] **U45** — [PLATFORM] `/platform` tổng quan → Chỉ platform-operator thấy; dashboard live.
  - Ghi chú: ______
- [ ] **U46** — [PLATFORM] `/platform/tenants` → Liệt kê 10 tenant (T001–T010) kèm status/class/blueprint.
  - Ghi chú: ______
- [ ] **U47** — [PLATFORM] Đăng ký / onboard tenant khách → Tenant mới vào sổ đăng ký, trạng thái onboard.
  - Ghi chú: ______
- [ ] **U48** — [PLATFORM] `/platform/launches` → Tiến trình 8 bước chạy tuần tự, cập nhật từng bước.
  - Ghi chú: ______
- [ ] **U49** — [PLATFORM] `/platform/blueprints` + `/platform/seed-packs` → Mở chi tiết 1 mục hiển thị cấu phần.
  - Ghi chú: ______
- [ ] **U50** — [PLATFORM] `/platform/backups` lịch + Chạy ngay → "Chạy ngay" tạo gói tức thì.
  - Ghi chú: ______
- [ ] **U51** — [PLATFORM] `/delivery` triển khai khách hàng → Mở 1 engagement xem tiến độ.
  - Ghi chú: ______

### 6j. Đa tenant (cách ly) — cần tài khoản T002, xem mục 3
- [ ] **U52** — [ENFORCE] Đăng nhập user T002 (`tenant-realestate-demo`) → Thấy đúng dữ liệu T002.
  - Ghi chú: ______
- [ ] **U53** — [ENFORCE] Kiểm tra cách ly khỏi T001 → KHÔNG thấy bất kỳ bản ghi nào của T001.
  - Ghi chú: ______
- [ ] **U54** — [ENFORCE] Tài liệu T002 vào folder riêng → Tách biệt lưu trữ T001.
  - Ghi chú: ______

### 6k. Console kỹ thuật
- [ ] **U70** — DevTools Console khi lướt tất cả màn → 0 lỗi đỏ (JS error / failed fetch) trên mọi route đã mở.
  - Ghi chú: ______

## 7. Báo cáo kết quả

- **Cách nhanh nhất:** dùng trang `/docs/test` như mô tả ở mục 5, bấm **"Sao chép kết quả"** và dán vào email/chat.
- **Cách dùng bản in này:** chụp ảnh hoặc gõ lại các dòng đã tick + ghi chú lỗi, gửi cho quản trị viên tenant X-TECH phụ trách XHub (hoặc bộ phận IT phụ trách nền tảng). Nếu không rõ gửi cho ai, hỏi lại người đã đưa bạn tài liệu này.
- Với mỗi lỗi (FAIL), luôn kèm: mã dòng (ví dụ U23), đường dẫn (URL) đang mở, và mô tả ngắn gọn bạn thấy gì (không cần thuật ngữ kỹ thuật) — kèm ảnh chụp màn hình nếu có thể.

---

_Tài liệu bàn giao kiểm thử (UAT) — XHub / X.Space / X.Office. Mirror nội dung với `/docs/test` (`USER_TEST_ROWS` trong `xhub-web/src/components/docs/test-data.ts`) và `docs/TEST_LOG.md`._
