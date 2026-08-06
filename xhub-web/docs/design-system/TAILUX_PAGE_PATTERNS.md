# Tailux — chỉ mục nội dung & UX của 6 dạng trang demo

> Khác với mục 3.2 `DEVELOPER_GUIDE.md` (map **component** XHub ↔ Tailux), tài liệu này ghi lại
> cách Tailux **bố trí nội dung** và **trải nghiệm người dùng** ở cấp độ trang — thứ tự khối,
> hành vi tương tác, câu chữ mẫu. Đây là phần Tailux đầu tư nhiều nhất (không chỉ đẹp từng nút
> bấm) và là thứ cần tra lại **trước khi dựng bất kỳ trang mới nào**, để trang mới của XHub có
> cùng "cảm giác dùng" với phần đã có, thay vì mỗi trang một kiểu bố cục.
>
> Nguồn khảo sát: `D:\Chinh\tailux\ts\demo\src\app\pages\` (bản Tailux gốc, KHÔNG sửa file này).
> *(Sửa lại từ tài liệu cũ: §3 `DEVELOPER_GUIDE.md` trước đây trỏ nhầm sang
> `D:\Code\handoff\xhub\tailux\...` — đường dẫn đó không còn tồn tại trên máy hiện tại; đường dẫn
> đúng là `D:\Chinh\tailux\ts\demo\...`, đã cập nhật lại ở cả 2 file.)*

## Cách dùng tài liệu này

Trước khi dựng 1 trang mới, xác định trang đó thuộc dạng nào trong 6 dạng dưới, đọc đúng mục
"Bố cục nội dung" (thứ tự khối — quan trọng nhất) + "Hành vi UX" (những chi tiết dễ quên: trạng
thái rỗng, xác nhận xoá, vị trí nút Lưu/Huỷ...), rồi map sang đúng component trong
`src/xhub/ui/*` (xem mục "Áp dụng cho XHub" mỗi phần). KHÔNG copy nguyên văn tiếng Anh — chỉ lấy
bố cục/hành vi, viết lại nội dung/câu chữ bằng tiếng Việt đúng nghiệp vụ XHub.

---

## 1. Trang chủ / Dashboard

**Nguồn:** `dashboards/sales/index.tsx` (đây chính là trang landing sau đăng nhập của Tailux demo).

**Bố cục nội dung (trên → dưới):**
1. **Không có tiêu đề/breadcrumb trang** — dashboard nhảy thẳng vào nội dung, không có `<h1>` mở đầu.
2. **Khối thống kê**:
   - Hàng 4 thẻ KPI bằng nhau (1→2→4 cột theo màn hình): nhãn + số lớn + xu hướng (mũi tên + %) bên trái, icon tròn màu bên phải.
   - Hàng biểu đồ: 1 biểu đồ cột rộng (có nút chuyển Ngày/Tháng/Năm) cạnh lưới 2×2 chỉ số phụ (biểu đồ mini + số).
3. **Lưới nội dung chính** (chia cột rộng/hẹp):
   - Cột rộng: **bảng dữ liệu chính** — thanh công cụ (tiêu đề + tìm kiếm + menu xuất) → bảng → phân trang → **thanh hành động nổi lên khi chọn dòng** (chỉ hiện khi có dòng được tick).
   - Cột hẹp (sidebar phụ, KHÔNG phải menu điều hướng): số dư/tổng hợp nổi bật → danh sách top (carousel) → dòng thời gian hoạt động nhóm → nguồn/kênh (kèm % xu hướng) → danh sách giao dịch gần nhất.

**Hành vi UX quan trọng:**
- Không có skeleton loading riêng cho từng khối — chỉ có 1 màn hình splash chung lúc mới vào app.
- Mọi khối phụ đều có nút "⋮" (kebab menu) mở menu thao tác phụ — pattern lặp lại nhất quán.
- Chọn dòng trong bảng: avatar đổi thành dấu tick khi hover/chọn (không dùng ô checkbox riêng).
- Responsive: lưới chỉ số phụ tự nhảy lên TRÊN biểu đồ chính ở màn hình nhỏ (không đơn thuần xếp chồng theo đúng thứ tự DOM).

**Áp dụng cho XHub:** đã khớp khá tốt với các trang tổng quan hiện có (`/manage`, `/office/revenue-kpi`) — dùng `StatCard` cho khối KPI hàng đầu, `SectionCard` cho từng khối phụ, `charts/{Area,Bar,Donut}Chart` cho biểu đồ. **Còn thiếu**: pattern "thanh hành động nổi khi chọn dòng" (sticky bulk-action bar) — `DataTable`/`PaginatedTable` hiện chưa có, cần bổ sung nếu có trang cần chọn nhiều dòng để xử lý hàng loạt (ví dụ duyệt nhiều nghĩa vụ hợp đồng cùng lúc).

---

## 2. Trang danh sách (Listing)

**Nguồn:** `tables/users-datatable/` (đầy đủ nhất) + `tables/orders-datatable-1/` (bộ lọc phong phú hơn, tham khảo riêng).

**Bố cục nội dung (trên → dưới):**
1. **Thanh công cụ hàng 1**: tiêu đề trang (trái) — In / Xuất (PDF, CSV) / menu "…" (Tạo mới / Chia sẻ / Nhập dữ liệu / Lưu view) (phải). Trên mobile, tất cả gộp vào 1 menu kebab.
2. **Thanh lọc hàng 2**: bộ lọc dạng tab/segment (vd lọc theo vai trò) bên trái; tìm kiếm + nút cấu hình bảng (ẩn/hiện cột, ghim cột, chế độ dày/thưa dòng, toàn màn hình) + chuyển đổi Danh sách/Lưới bên phải.
   - Biến thể lọc phong phú hơn (orders): thêm lọc theo trạng thái (chọn nhiều, dạng popover), lọc khoảng ngày, lọc khoảng số tiền — và nút **"Xoá bộ lọc"** CHỈ hiện khi có ít nhất 1 bộ lọc đang bật.
3. **Vùng dữ liệu** — 2 kiểu hiển thị đổi qua lại được (lưu lựa chọn vào localStorage):
   - **Bảng**: cột trạng thái (công tắc bật/tắt), cột tên (avatar+tên, avatar đổi thành tick khi chọn), cột phân loại (badge viền màu), cột copy-được (số điện thoại/email), cột hành động (icon nhanh + menu "⋮": Xem/Sửa/Xoá).
   - **Lưới thẻ**: mỗi thẻ = badge trạng thái ở góc + avatar lớn (hover hiện tên/tuổi, bấm để chọn) + tên + các dòng thông tin phụ + hàng hành động dưới cùng.
4. **Chân trang**: dòng chữ "hiện X-Y trong tổng Z" + điều khiển phân trang.
5. **Thanh hành động khi chọn dòng** (nổi lên từ dưới, chỉ hiện khi ≥1 dòng được chọn): "N đã chọn / M" + Xoá + In + menu "Thêm".

**Hành vi UX quan trọng — quan trọng nhất trong cả 6 mục:**
- **Xoá LUÔN qua hộp thoại xác nhận** (`ConfirmModal`) — 1 component dùng chung cho MỌI hành động xoá trong toàn bộ demo (dòng đơn lẻ lẫn xoá hàng loạt), có 3 trạng thái: đang hỏi → đang xoá (spinner) → thành công/lỗi. Không có nơi nào trong trang danh sách xoá thẳng không hỏi.
- Bật/tắt trạng thái (switch) trong bảng: chạy loading giả 1s rồi báo toast thành công — không khoá cả trang trong lúc chờ.
- Không tìm thấy trạng thái "0 kết quả" (rỗng) được viết rõ trong demo trang danh sách (dữ liệu mẫu luôn có sẵn) — **XHub phải tự thiết kế câu chữ trạng thái rỗng cho từng trang**, Tailux không có sẵn mẫu ở đây.
- Cột ghim/ẩn hiện + kiểu xem (bảng/lưới) lưu theo từng bảng vào localStorage — trải nghiệm "nhớ lựa chọn lần trước" của người dùng.

**Áp dụng cho XHub:** `DataTable`/`PaginatedTable` đã có. Hộp thoại xác nhận xoá dùng chung **đã xây xong** — `ConfirmDialog` (`src/xhub/ui/ConfirmDialog.tsx`), xem quy tắc 3 ở cuối tài liệu. **Còn thiếu**: câu chữ trạng thái rỗng chuẩn hoá (hiện `DataTable` có prop `empty` nhưng nội dung do từng trang tự viết, chưa có bộ câu mẫu tiếng Việt thống nhất).

---

## 3. Trang chi tiết (Detail)

**Nguồn:** `prototypes/post-details/` (dạng bài viết + tác giả) và `prototypes/invoice-1/` (dạng chứng từ in được) — 2 biến thể khác nhau, đại diện cho 2 loại "trang 360" XHub hay cần.

**Bố cục nội dung — biến thể "hồ sơ + nội dung" (post-details):**
1. Lưới 2 cột: cột chính (rộng) + cột phụ (hẹp, dính lại khi cuộn — `sticky`).
2. Cột chính: khối tiêu đề (avatar tác giả — hover hiện thẻ mini + nút Follow — tên, ngày, thời lượng đọc) → nội dung chính → chân trang (nút like/comment dạng pill) → khối "Bài viết liên quan" riêng bên dưới (list card: ảnh, tag, tiêu đề, mô tả rút gọn 3 dòng, tác giả, ngày).
3. Cột phụ (dính khi cuộn): thẻ thông tin tác giả (ảnh bìa + avatar đè lên + tên + số theo dõi + tiểu sử ngắn + nút Follow/nhắn tin) → danh sách "Bài khác của tác giả".

**Bố cục nội dung — biến thể "chứng từ in được" (invoice):**
1. Tiêu đề trang + nút In + nút Cài đặt (không có breadcrumb).
2. 1 khối thẻ lớn — **chính khối này được gửi in** (không in cả trang):
   - Hàng 1: thông tin đơn vị xuất vs. thông tin chứng từ (mã, ngày tạo, hạn) — xếp chồng trên mobile.
   - Hàng 2: "Xuất cho:" vs "Hình thức thanh toán:".
   - Bảng dòng mục (mã, mô tả, số lượng/giờ công, đơn giá, thành tiền) — sọc xen kẽ.
   - Khối tổng cộng (căn phải): tạm tính, chiết khấu, thuế, **Tổng cộng** (đậm).

**Hành vi UX quan trọng:**
- Cột phụ dùng CSS `sticky` (không phải fixed) — cuộn theo nội dung chính nhưng dừng lại đúng dưới header, giữ thông tin tác giả/liên quan luôn trong tầm mắt.
- KHÔNG dùng tab để chia mục — cả 2 biến thể đều là 1 mạch cuộn dài, chia khối bằng thẻ/đường kẻ, không phải tab ẩn/hiện.
- Trang chứng từ: nút In chỉ in đúng 1 khối (không in menu/sidebar) — kỹ thuật "in đúng vùng nội dung", không phải in nguyên trang.

**Áp dụng cho XHub:** khớp trực tiếp với các trang 360 đã có (`/office/customers/[id]`, `/office/contracts/[id]`) — đã đúng tinh thần "1 mạch cuộn, chia khối bằng Card" chứ không dùng tab, nên **giữ nguyên hướng hiện tại**. Biến thể "chứng từ in được" đáng tham khảo khi làm màn in hợp đồng/hoá đơn thật sau này (chưa có trang nào trong XHub cần in tới giờ).

---

## 4. Form dạng popup (Modal)

**Nguồn:** `apps/kanban/Modals/AddBoard.tsx` (đơn giản), `apps/kanban/Modals/EditTask/index.tsx` (phức tạp), `apps/todo/Modals/NewTask.tsx` (dạng trượt từ phải).

**3 kiểu popup Tailux đang dùng — KHÔNG thống nhất, phải tự chọn 1 kiểu cho XHub:**

| Kiểu | Vị trí | Có nút × riêng? | Khi nào dùng |
|---|---|---|---|
| Modal giữa màn hình, đơn giản | Giữa, che mờ nền | Không — đóng bằng bấm ra ngoài hoặc Huỷ | Form ngắn, 1-2 nhóm trường (vd tạo nhanh 1 mục) |
| Modal giữa màn hình, lớn | Giữa, che mờ nền, cao gần full trên mobile | Không — dùng nút "ESC" dạng phím tắt thay cho × | Form nhiều nhóm trường nhưng vẫn là sửa nhanh (không cần rời trang) |
| Trượt từ phải (drawer) | Cạnh phải, có header riêng nền khác màu | Có — nút × chuẩn trong header | Form trung bình, muốn có cảm giác "ngăn kéo" tách biệt rõ với trang nền |

**Bố cục nội dung chung (mẫu drawer — khớp nhất với `FormDrawer` đã có của XHub):**
1. Header riêng (nền khác màu nội dung): tiêu đề + các toggle nhanh (nếu có) + nút ×.
2. Thân form: lưới 2 cột (1 cột trên mobile), trường full-width (mô tả) chiếm cả 2 cột.
3. Chân form CÓ đường viền trên, dính ở đáy: Huỷ (flat) + nút chính (primary), luôn căn phải.

**Hành vi UX quan trọng:**
- **Tự động focus vào trường đầu tiên** khi mở popup — ưu tiên thao tác bằng bàn phím.
- Lỗi validate hiện **ngay dưới/cạnh từng trường**, không có banner tổng hợp lỗi ở đầu form.
- Nhóm trường dạng chọn 1 trong nhiều (radio) khi lỗi: cả khung nhóm viền đỏ, không chỉ text đỏ.
- **Không nhất quán về xác nhận xoá**: form popup (sửa nhanh) bấm Xoá là xoá luôn, KHÔNG qua hộp thoại xác nhận — khác hẳn trang danh sách (mục 2) luôn hỏi trước. Nút Xoá tách hẳn sang bên trái, Huỷ/Lưu bên phải, để tránh bấm nhầm.

**Áp dụng cho XHub:** `FormDrawer` hiện có đã đúng kiểu "trượt từ phải" — giữ nguyên, đây là lựa chọn tốt nhất trong 3 kiểu (rõ ràng, có nút × chuẩn). **Đã chốt** (05/08/2026): nút Xoá trong popup sửa nhanh KHÔNG xoá thẳng như Tailux — luôn qua `ConfirmDialog`, giống hệt trang danh sách (xem quy tắc 3 ở cuối tài liệu), riêng dữ liệu tài chính/nhạy cảm phải gõ lại mã bản ghi.

---

## 5. Form điều hướng riêng trang — nhiều bước (Wizard)

**Nguồn:** `forms/add-product-form/` — route `/forms/add-product-form`.

**Bố cục nội dung:**
1. Tiêu đề trang đơn giản ("Thêm sản phẩm mới"), không có nút Lưu/Huỷ ở đầu trang.
2. Lưới 2 cột: **thanh bước dọc** (dính khi cuộn) bên trái + **thẻ bước đang làm** bên phải.
   - Thanh bước: các nút tròn đánh số nối bằng đường kẻ dọc — đã xong (tick), đang làm (viền nổi bật), chưa tới (mờ, KHÔNG bấm được).
   - Thẻ bước: icon + tên bước ở đầu, thân là form CHỈ của bước đó, chân thẻ có Huỷ + "Tiếp theo" (bước cuối đổi thành "Hoàn tất").
3. Màn hoàn tất (thay thế toàn bộ khối wizard khi xong): hiệu ứng confetti + dấu tick lớn + tiêu đề chúc mừng + đoạn cảm ơn + nút "Về trang chủ".

**Hành vi UX quan trọng:**
- **Đi từng bước một chiều, có kiểm soát**: chỉ bấm được vào bước ĐÃ hoàn thành để xem/sửa lại — không bấm nhảy cóc tới bước chưa làm.
- Mỗi bước có schema kiểm tra riêng — bấm "Tiếp theo" chỉ thành công khi bước hiện tại hợp lệ (không phải kiểm tra dồn tới cuối).
- Hoàn tất thay hẳn giao diện (không phải toast) — dùng cho việc **quan trọng, nhiều bước** (cảm giác "đã xong việc lớn").

**Áp dụng cho XHub:** chưa có tương đương trong `xhub/ui` — **cần xây mới** nếu có nghiệp vụ nào thật sự nhiều bước phụ thuộc nhau (ví dụ: tạo Hợp đồng từ đầu gồm chọn khách hàng → thêm dòng hợp đồng → xác nhận điều khoản → xem lại). Chỉ dùng wizard khi các bước THỰC SỰ phụ thuộc tuần tự — nếu các trường độc lập nhau, dùng mục 6 (đơn giản hơn, không nên ép vào wizard cho có).

---

## 6. Form tạo mới đơn giản — 1 trang, không wizard

**Nguồn:** `forms/new-post-form/` — route `/forms/new-post-form`.

**Bố cục nội dung:**
1. Header trang: icon + tiêu đề ("Bài viết mới") bên trái; "Xem trước" (outline) + "Lưu" (primary) bên phải — nút Lưu nằm ở HEADER, submit form nằm dưới bằng thuộc tính `form="..."` (không phải nút trong form).
2. 1 form duy nhất, lưới 2 cột — **mọi thứ hiện cùng lúc, không ẩn/hiện theo bước**:
   - Cột chính (rộng): tiêu đề khối "Thông tin chung" → các trường chính → soạn thảo nội dung → tải ảnh bìa.
   - Cột phụ (hẹp), 2 thẻ xếp chồng: thẻ 1 không tiêu đề (phân loại, tác giả, thẻ gắn nhãn, ngày đăng); thẻ 2 "Dữ liệu SEO" kèm icon trợ giúp (bấm/hover hiện chú thích "vì sao cần mục này").
3. Sau khi lưu: **không chuyển trang, không màn hoàn tất riêng** — chỉ hiện toast xác nhận rồi form tự làm mới tại chỗ, để tạo tiếp mục mới ngay.

**Hành vi UX quan trọng — đối lập trực tiếp với mục 5:**

| | #5 Wizard nhiều bước | #6 Trang đơn giản |
|---|---|---|
| Cấu trúc | Từng bước 1, ẩn các bước khác | 1 màn, mọi khối hiện cùng lúc |
| Vị trí nút Lưu | Trong chân từng thẻ bước | Ở header trang, submit form-by-id |
| Sau khi lưu | Màn chúc mừng full-screen, rời khỏi form | Toast + form reset tại chỗ, ở lại để tạo tiếp |
| Khi nào dùng | Các trường phụ thuộc tuần tự, việc quan trọng/hiếm khi làm | Các trường độc lập nhau, việc làm thường xuyên/lặp lại |

- Nút "Xem trước" trong bản demo **chưa nối hành vi gì** (chỉ là chỗ để dành) — không copy nguyên trạng thái này sang XHub, phải quyết định rõ preview làm gì hoặc bỏ hẳn nút.
- Icon "trợ giúp theo ngữ cảnh" (dấu ? nhỏ cạnh tiêu đề khối) là pattern hay: dùng cho khối nào có tên/khái niệm không tự giải thích được, thay vì chú thích dài ngay dưới tiêu đề.

**Áp dụng cho XHub:** đây là pattern PHÙ HỢP NHẤT để tái dùng ngay — khớp với các form tạo Khách hàng/Cơ hội/Báo giá hiện tại (đều là "tạo xong rồi tạo tiếp", tần suất cao, trường phần lớn độc lập). Gợi ý bổ sung cho `FormDrawer`/trang tạo mới của XHub: sau khi lưu thành công, **cho phép chọn "Lưu & tạo tiếp"** bên cạnh "Lưu & đóng" — đúng tinh thần "ở lại tạo tiếp" của mẫu này, thay vì luôn điều hướng ra khỏi form.

---

## Quy tắc chọn pattern (tổng hợp) — ĐÃ CHỐT 05/08/2026

1. **Popup (mục 4) hay điều hướng riêng trang (mục 5/6)?** — Popup cho sửa nhanh 1 bản ghi đơn giản, không rời khỏi ngữ cảnh đang xem (vd sửa nhanh 1 dòng trong bảng). Điều hướng riêng trang khi form dài, nhiều khối, hoặc là hành động "tạo mới" chính của cả trang.
2. **Wizard nhiều bước (mục 5) hay 1 trang (mục 6)? — Chốt: giữ CẢ HAI**, không bỏ pattern nào. Chỉ dùng wizard khi các bước **phụ thuộc thứ tự thật sự** (bước sau cần dữ liệu/điều kiện của bước trước) và việc này không làm thường xuyên. Nếu các trường độc lập và việc làm lặp đi lặp lại (nhập liệu hàng ngày), dùng mẫu 1 trang — nhanh hơn, không bắt người dùng đi qua nhiều màn hình cho việc quen tay. Ví dụ áp dụng: tạo Khách hàng/Cơ hội/Báo giá → mẫu 1 trang (mục 6); luồng tạo Hợp đồng từ đầu có nhiều bước phụ thuộc (chọn khách hàng → thêm dòng → xác nhận điều khoản → xem lại) → wizard (mục 5).
3. **Xoá dữ liệu — 2 mức, đều bắt buộc xác nhận, không có ngoại lệ nào xoá thẳng:**
   - **Mức thường** (mọi bản ghi khác): hộp thoại Yes/No dùng chung — component `ConfirmDialog` (`src/xhub/ui/ConfirmDialog.tsx`), bất kể mở từ trang danh sách hay từ popup sửa nhanh. Đây là điểm XHub cố ý làm chặt hơn bản gốc Tailux (bản gốc: trang danh sách luôn hỏi, nhưng popup sửa nhanh xoá thẳng không hỏi — XHub bỏ hẳn sự không nhất quán đó).
   - **Mức nghiêm ngặt — dữ liệu tài chính/nhạy cảm** (hợp đồng, hoá đơn, yêu cầu xuất hoá đơn, thanh toán...): dùng CÙNG `ConfirmDialog` nhưng truyền thêm prop `typedConfirmation={{ code }}` — bắt người dùng **gõ lại đúng mã bản ghi** (vd `CT-2026-014`) thì nút Xoá mới bật lên được, không chỉ bấm Yes/No. Đây là quyết định chủ đầu tư chốt trực tiếp (05/08/2026), theo đúng kiểu GitHub "gõ lại tên repo để xoá" — chặt hơn hẳn 1 lần bấm xác nhận thường.
   - Cách chọn mức nào: nếu hành động xoá làm mất dữu liệu có giá trị tiền/pháp lý hoặc khó khôi phục đúng như cũ → dùng mức nghiêm ngặt. Còn lại (khách hàng, liên hệ, cơ hội chưa chốt, mục danh mục...) → mức thường là đủ.
4. **Trạng thái rỗng** — Tailux không có mẫu câu chữ sẵn cho "0 kết quả"; mỗi trang XHub tự viết, nhưng nên theo 1 giọng chung: nêu lý do (chưa có dữ liệu / không khớp bộ lọc) + hành động gợi ý tiếp theo (tạo mới / xoá bộ lọc).
