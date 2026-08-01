# Hướng dẫn sử dụng XHub

_Cổng làm việc hợp nhất cho X-TECH — XHub · X.Space · X.Office_

> Tài liệu này dành cho người dùng nghiệp vụ tại X-TECH (không phải lập trình viên). Mọi màn hình, nút bấm và nhãn nhắc đến ở đây đều có thật trong ứng dụng.

---

## Mục lục

1. [Giới thiệu](#1-giới-thiệu)
2. [Nguyên tắc quản trị nền tảng](#2-nguyên-tắc-quản-trị-nền-tảng)
3. [Điều hướng chung](#3-điều-hướng-chung)
4. [Trang chủ (điều hành & thông báo)](#4-trang-chủ)
5. [Công việc (Work v2: hộp việc · phê duyệt · Gantt · Kanban · danh mục dự án)](#5-công-việc)
6. [Quản trị điều hành (Management OS)](#6-quản-trị-điều-hành-management-os)
7. [Nhân sự & Công (nghỉ phép · hiện diện nhóm)](#7-nhân-sự--công)
8. [X.Space (trao đổi & cộng tác)](#8-xspace)
9. [X.Office (quy trình & vận hành)](#9-xoffice)
10. [Doanh nghiệp & Quản trị hệ thống](#10-doanh-nghiệp--quản-trị-hệ-thống)
11. [Câu hỏi thường gặp & Mẹo](#11-câu-hỏi-thường-gặp--mẹo)

---

## 1. Giới thiệu

**XHub là gì?** XHub là một cổng làm việc hợp nhất: thay vì mở nhiều phần mềm rời rạc, bạn có một nơi duy nhất để theo dõi tình hình điều hành, xử lý công việc và phê duyệt, trao đổi với đồng nghiệp và khách hàng, chạy các quy trình nghiệp vụ, và tra cứu dữ liệu doanh nghiệp.

Nền tảng gồm ba mảng gắn kết:

- **XHub** — không gian điều hành và công việc (bảng tổng quan, hộp việc, phê duyệt).
- **X.Space** — nơi trao đổi & cộng tác theo channel, kiểu như một ứng dụng chat công việc.
- **X.Office** — nơi thiết kế, chạy và giám sát các quy trình nghiệp vụ (mua sắm, thanh toán, tuyển dụng, ticket…), có trợ lý **X.AI** hỗ trợ.

**Ai dùng?** Mọi nhân sự X-TECH. Ban điều hành xem bảng tổng quan và phê duyệt; nhân viên xử lý hộp việc và trao đổi; quản trị viên tenant cấu hình người dùng, tổ chức, sao lưu…

### Đăng nhập

1. Mở trang `/login`.
2. Nhập **Email hoặc userId** (ví dụ `name@xtech.com.vn`), rồi bấm **Đăng nhập**.
3. Ở bản demo còn có mục **Chọn nhanh (demo)** — bấm vào tên một người dùng để đăng nhập ngay bằng tài khoản đó.
4. Sau khi đăng nhập bạn sẽ vào thẳng **Tổng quan điều hành**.

### Ảnh niệm về giao diện

Sau khi vào, màn hình được chia làm ba phần:

- **Thanh biểu tượng (icon rail) bên trái** — 5 biểu tượng tương ứng 5 workspace: Trang chủ, Công việc, X.Space, X.Office, Doanh nghiệp.
- **Bảng ngữ cảnh (prime panel)** — nằm ngay cạnh rail, liệt kê các màn con của workspace đang chọn.
- **Vùng nội dung** — phần lớn màn hình, hiển thị màn bạn đang mở.
- **Thanh trên cùng** — có **chuông thông báo** (kèm số việc chưa đọc) và **ảnh đại diện (avatar)** của bạn.

### Chế độ sáng / tối

Ứng dụng hỗ trợ giao diện **Sáng**, **Tối** và **Hệ thống** (theo máy). Đổi trong **Cài đặt cá nhân** (xem mục 3).

### Dùng trên di động

Trên điện thoại, thanh biểu tượng chuyển thành **thanh điều hướng dưới đáy** với tối đa 5 mục và nút **Thêm** để mở các mục còn lại. Bảng và biểu đồ tự cuộn ngang khi màn hình hẹp.

---

## 2. Nguyên tắc quản trị nền tảng

Trước khi đi vào từng màn hình, phần này tóm tắt **cam kết quản trị** mà toàn bộ nền tảng XHub được thiết kế theo — để ban lãnh đạo hiểu *vì sao* các màn hình trông như vậy, không chỉ *cách bấm*. Đây là 7 nguyên tắc nền, mỗi màn hình cụ thể ở các mục sau sẽ nhắc lại nguyên tắc liên quan.

1. **Mỗi chỉ số phải có chủ.** Không có số liệu vô chủ: mọi KPI/metric đều có chủ sở hữu (owner), công thức tính, nguồn dữ liệu và tần suất cập nhật rõ ràng — nếu thiếu một trong các yếu tố này thì chưa được coi là chỉ số quản trị hợp lệ.
2. **Quyết định quan trọng luôn có vai trò rõ ràng.** Theo mô hình **RAPID** (Bain & Company): ai **đề xuất** (Recommend), ai **đồng thuận** (Agree), ai **thực thi** (Perform), ai **được hỏi ý kiến** (Input), ai **ra quyết định cuối** (Decide). Không có quyết định "trôi nổi" không rõ ai chịu trách nhiệm.
3. **AI chỉ gợi ý, con người luôn xác nhận.** Trợ lý X.AI tóm tắt, cảnh báo và đề xuất bản nháp; nhưng không tự phê duyệt, không tự thay đổi baseline, không tự chấm điểm hiệu suất con người. Mọi hành động có hiệu lực đều cần một người bấm xác nhận.
4. **Không có "điểm số tổng" che giấu vấn đề.** Đây là nguyên tắc **quản trị theo ngoại lệ (management-by-exception)**: một scorecard/rollup không được phép hiển thị một con số trung bình đẹp trong khi bên dưới có chỉ số đang đỏ. Vấn đề cụ thể luôn phải nổi lên, không bị số gộp che khuất.
5. **Chiến lược, chỉ số vận hành và mục tiêu tham vọng là ba việc khác nhau.** Balanced Scorecard (chiến lược theo 4 khía cạnh Tài chính/Khách hàng/Quy trình/Năng lực), KPI (sức khỏe vận hành lặp lại) và OKR (mục tiêu tham vọng theo chu kỳ) không được gộp lẫn — một OKR không phải là danh sách việc cần làm, một KPI vận hành không tự nhiên trở thành OKR.
6. **Dữ liệu mỗi công ty con/tenant tách biệt hoàn toàn.** Áp dụng row-level security (RLS): dữ liệu của một tenant không bao giờ lộ sang tenant khác, kể cả khi cùng chạy trên một hạ tầng.
7. **Chia sẻ thông tin theo nguyên tắc "cần biết" (need-to-know).** Khi phối hợp liên phòng ban/liên dự án, người ngoài nhóm chỉ thấy tiến độ tổng quan (roll-up), không thấy chi tiết nội bộ, tài liệu hay việc con — trừ khi được cấp quyền đầy đủ.

Các nguyên tắc này bám theo các chuẩn quản trị phổ biến: **Balanced Scorecard** (Kaplan & Norton), **OKR** (Grove/Doerr), **RAPID** (Bain), **COSO/ISO 31000** (quản trị rủi ro), **PMI Portfolio/Program/Project Management**, và khung phân loại quy trình **APQC**. Mỗi mục dưới đây sẽ chỉ ra nguyên tắc cụ thể áp dụng cho từng tính năng.

---

## 3. Điều hướng chung

### 5 workspace trên thanh biểu tượng

| Biểu tượng | Workspace | Dùng để |
|---|---|---|
| Trang chủ | **Trang chủ** | Bảng tổng quan điều hành, bảng kinh doanh, không gian cá nhân, thông báo |
| Công việc | **Công việc** | Hộp việc hợp nhất, phê duyệt, công việc & chỉ đạo, dự án |
| X.Space | **X.Space** | Trao đổi theo channel, channel khách hàng 360, tin nhắn trực tiếp |
| X.Office | **X.Office** | Danh mục quy trình, vận hành (instances), giám sát |
| Doanh nghiệp | **Doanh nghiệp** | Khách hàng, tài liệu, báo cáo, ứng dụng, và Quản trị |

### Mở các màn con

Bấm một biểu tượng workspace → **bảng ngữ cảnh** bên cạnh hiện danh sách các màn con. Bấm một mục để mở. Một số nhóm (ví dụ **Quản trị** trong Doanh nghiệp, **Channel** trong X.Space) có thể mở rộng/thu gọn để lộ các mục bên trong.

### Thu gọn / mở rộng menu

Bạn chọn được **Kiểu điều hướng** phù hợp thói quen:

- **Gọn theo ngữ cảnh** — thanh biểu tượng + bảng ngữ cảnh (mặc định).
- **Menu đầy đủ** — một sidebar duy nhất hiển thị toàn bộ menu.

Đổi kiểu trong **Cài đặt cá nhân**.

### Chuông thông báo

Biểu tượng **chuông** trên thanh trên cùng hiện số **chưa đọc**. Bấm vào để xem danh sách nhanh, đánh dấu đã đọc, và bấm thẳng vào một thông báo để đi tới nơi liên quan. Trang đầy đủ nằm ở **Trang chủ › Thông báo** (`/notifications`).

### Cài đặt cá nhân

**Cách mở:** bấm **avatar** góc trên bên phải → chọn **Cài đặt cá nhân** (dòng "Giao diện, kiểu điều hướng, mật độ"). Một khay trượt (drawer) hiện ra từ bên phải, cho phép chỉnh:

- **Kiểu điều hướng** — Gọn theo ngữ cảnh / Menu đầy đủ.
- **Giao diện** — Hệ thống / Sáng / Tối.
- **Màu chủ đạo** — chọn trong 6 màu.
- **Mật độ** — **Thoải mái** hoặc **Gọn** (khoảng cách giữa các phần tử).

Trong cùng menu avatar còn có **Hồ sơ** (mở "Không gian của tôi") và nút **Đăng xuất**.

---

## 4. Trang chủ

Workspace **Trang chủ** gom các bảng tổng quan và thông báo. Bốn màn con:

### Tổng quan điều hành (`/home/executive`)

Bức tranh sức khỏe doanh nghiệp cho ban điều hành. Gồm:

- Dải chỉ số (StatCard): **Doanh thu tháng**, **Công nợ phải thu**, **Chờ phê duyệt**, **Dự án đang chạy**, **Việc quá hạn**, **HĐ sắp hết hạn**.
- Biểu đồ **Doanh thu 6 tháng** và **Doanh thu theo sản phẩm**.
- Bảng **Chỉ đạo & watchlist** (tiến độ từng chỉ đạo).
- Thẻ **Cảnh báo rủi ro dự án**, **Phê duyệt ưu tiên**, **Lịch hôm nay**, **Hiệu suất phòng ban**.
- Thẻ **X.AI** tóm tắt buổi sáng (chỉ hỗ trợ đọc, không tự phê duyệt).

### Bảng điều hành kinh doanh (`/home/sales`)

Dành cho kinh doanh: **Pipeline cơ hội theo giai đoạn**, **Cơ hội trọng điểm**, **Hiệu suất đội ngũ**, **Khách hàng ưu tiên**, **Phê duyệt bán hàng**, **Lịch hẹn khách hàng**.

### Không gian của tôi (`/home/me`)

Trang cá nhân: **Việc ưu tiên**, **Lịch làm việc hôm nay**, **Tài liệu gần đây**, **X.AI gợi ý cho bạn**, **Mục tiêu tuần**, **Thông báo** và **Nhắc đến bạn**.

### Thông báo (`/notifications`)

Danh sách đầy đủ mọi thông báo (được giao việc, nhắc hạn, quá hạn, kết quả phê duyệt…). Có thể đánh dấu đã đọc và bấm để đi tới mục liên quan.

---

## 5. Công việc

Workspace **Công việc** là nơi xử lý mọi việc cần bạn hành động, đồng thời là nơi lập kế hoạch, theo dõi tiến độ và quản trị danh mục dự án (Work v2). Các màn con:

### Hộp việc hợp nhất (`/inbox`)

Một inbox duy nhất gom mọi loại việc: **Phê duyệt**, **Công việc**, **Trao đổi**, **Khách hàng**, **Dự án**. Phần phê duyệt được lấy trực tiếp từ nguồn dữ liệu chính thức của X.Office (hiển thị nhãn `SoR: XOFFICE`).

Giao diện gồm: dải chỉ số (**Tổng việc**, **Cần xử lý**, **Quá hạn**, **Phê duyệt**), các **thẻ lọc theo loại** (Tất cả / Phê duyệt / Công việc…), ô **tìm kiếm** theo tiêu đề/nội dung, và ô chọn **Chỉ hiện quá hạn / cận SLA**. Bảng bên trái liệt kê việc (có cột **Loại**, **Tiêu đề**, **Phụ trách**, **Trạng thái**, **SLA** và phân trang); bảng bên phải là **Chi tiết** của mục đang chọn.

> **Cách làm — Mở & phê duyệt một mục trong Hộp việc**
> 1. Vào **Công việc › Hộp việc hợp nhất**.
> 2. (Tuỳ chọn) Bấm thẻ lọc **Phê duyệt** hoặc gõ từ khoá vào ô tìm kiếm; tích **Chỉ hiện quá hạn / cận SLA** nếu cần ưu tiên.
> 3. Bấm một dòng để xem **Chi tiết** bên phải.
> 4. Với mục phê duyệt, bấm **Xem & phê duyệt** (hoặc **Mở đầy đủ →**) để vào trang xử lý chi tiết.
> 5. Ở trang chi tiết, xem **Hạng mục thanh toán**, **Bằng chứng đính kèm**, **Luồng phê duyệt** và thẻ **X.AI** tóm tắt/cảnh báo.
> 6. Trong ô **Quyết định phê duyệt**, bấm **Duyệt** hoặc **Từ chối**, nhập **Ghi chú** (bắt buộc khi từ chối), rồi bấm **Xác nhận duyệt/từ chối**.
>
> _Lưu ý: X.AI chỉ tóm tắt và cảnh báo — quyết định do bạn bấm thủ công. Ở bản demo, thao tác được ghi vào nhật ký kiểm toán chứ chưa gọi ERP thật._

### Trung tâm phê duyệt (`/approvals`)

Hàng đợi phê duyệt tập trung, sắp xếp ưu tiên (quá hạn trước). Có dải chỉ số (**Tổng yêu cầu**, **Chờ duyệt**, **Quá hạn SLA**, **Tổng giá trị**) và các tab **Tất cả / Chờ duyệt / Quá hạn SLA**. Chọn một yêu cầu để xem **Tóm tắt yêu cầu**, **Luồng phê duyệt** (các bước và người phụ trách), và thẻ **X.AI kiểm tra nhanh**.

> **Cách làm — Xem và phê duyệt từ Trung tâm phê duyệt**
> 1. Vào **Công việc › Trung tâm phê duyệt**.
> 2. Chọn tab **Chờ duyệt** để lọc việc còn tồn.
> 3. Bấm một yêu cầu trong danh sách để xem tóm tắt và luồng phê duyệt bên phải.
> 4. Bấm **Mở trang xử lý & phê duyệt** để vào trang chi tiết và ra quyết định (như các bước ở Hộp việc).

### Công việc & chỉ đạo (`/work`)

Danh sách công việc và các chỉ đạo được giao, kèm tiến độ.

### Dự án (`/work/projects`, `/work/projects/[id]`)

Danh sách **ExecutionProject** (dự án đang triển khai) và trang chi tiết từng dự án: WBS (cây hạng mục công việc), tiến độ, baseline, rủi ro. Đây là nơi duy nhất nắm dữ liệu thực thi dự án (health, task, ngày tháng) — các màn quản trị đầu tư ở mục 6 chỉ **đọc** từ đây, không tạo bản sao.

### Gantt & baseline (`/work/projects/[id]/gantt`)

> **Nguyên tắc quản trị:** kỷ luật quản lý dự án theo **PMI** — một dự án chỉ đo được lệch tiến độ thật khi có một **kế hoạch gốc (baseline) bất biến** để so sánh. Nếu kế hoạch bị sửa liên tục theo thực tế thì không bao giờ biết dự án đang trễ so với cam kết ban đầu.

Biểu đồ Gantt hiển thị timeline theo ngày, có **thanh baseline** (kế hoạch gốc, hiển thị mờ) song song với **thanh actual/forecast** (thực tế/dự báo, đậm) để nhìn ngay độ lệch. Có đường **phụ thuộc** giữa các việc theo 4 kiểu chuẩn PMI: **FS** (Finish-to-Start), **SS** (Start-to-Start), **FF** (Finish-to-Finish), **SF** (Start-to-Finish); có mốc (milestone) và cây WBS thu/mở. Kéo hoặc đổi kích thước một thanh việc sẽ cập nhật ngày ngay; nếu thao tác phá vỡ một phụ thuộc bắt buộc, hệ thống báo lỗi và tự khôi phục lại trạng thái trước đó — bảo đảm lịch trình không bị vô tình làm sai lệch.

> **Nguyên tắc quản trị — vì sao phụ thuộc (dependency) quan trọng hơn là để "vẽ cho đẹp":** đây là nền tảng của **Critical Path Method (CPM)**, một kỹ thuật cốt lõi trong PMI Project Management. Chuỗi phụ thuộc giữa các việc (`WorkDependency` FS/SS/FF/SF) cho phép hệ thống xác định **đường găng (critical path)** — chuỗi phụ thuộc dài nhất quyết định ngày hoàn thành sớm nhất có thể của cả dự án. Một việc nằm trên đường găng bị trễ sẽ kéo trễ toàn bộ dự án; trong khi các việc không nằm trên đường găng có **thời gian dự trữ (slack/float)** và có thể trễ một chút mà không ảnh hưởng ngày hoàn thành chung. Vì vậy dependency + baseline không chỉ để trực quan hoá — chúng là cơ sở để phân tích **rủi ro lịch trình (schedule risk analysis)**: khi có nhiều việc trễ cùng lúc, người quản lý nên ưu tiên xử lý việc nằm trên đường găng trước, thay vì xử lý theo cảm giác "việc nào trông gấp hơn".
>
> _Lưu ý hiện trạng: mô hình dữ liệu (`WorkDependency` FS/SS/FF/SF, `ProjectBaseline`) đã đủ để tính đường găng, nhưng màn Gantt hiện tại **chưa highlight trực quan đường găng** (chưa tô màu/đánh dấu các việc thuộc critical path). Đây là một hạng mục còn thiếu, không phải tính năng đã có — nguyên tắc CPM áp dụng ngay từ bây giờ trong cách đọc phụ thuộc, còn phần hiển thị trực quan cần bổ sung ở phase sau._

### Gantt phối hợp (chia sẻ liên phòng ban)

> **Nguyên tắc quản trị:** nguyên tắc **"cần biết" (need-to-know)** trong chia sẻ thông tin nội bộ — phối hợp liên phòng ban cần thấy tiến độ tổng quan để đồng bộ kế hoạch, nhưng không cần (và không nên) thấy chi tiết nội bộ, tài liệu đính kèm hay việc con của một đội khác.

Khi một dự án được chia sẻ ở chế độ **SUMMARY** cho người ngoài nhóm, người xem chỉ thấy **thanh việc cha đã roll-up** (tiến độ tổng hợp từ các việc con), có nhãn **"Chia sẻ phối hợp"** — không thấy việc con, mô tả chi tiết hay tài liệu. Việc tính roll-up được thực hiện ở máy chủ, người xem SUMMARY không bao giờ nhận được dữ liệu chi tiết dù có cố truy vấn trực tiếp.

### Kanban (`/work/board`)

> **Nguyên tắc quản trị:** nguyên tắc **phân tích đa chiều** — một danh sách việc không chỉ có một trục "trạng thái"; quản trị hiệu quả cần nhìn cùng một tập việc theo nhiều lát cắt khác nhau (ai làm, loại việc gì, giai đoạn nào, thuộc bộ phận nào) để phát hiện điểm nghẽn thực sự.

Bảng Kanban kéo-thả thẻ việc giữa các cột trạng thái (lưu ngay vào máy chủ; nếu trạng thái đích không hợp lệ, thao tác tự rollback). Ngoài nhóm theo cột trạng thái, có thể **group theo tag hoặc theo dimension** do tenant tự định nghĩa — ví dụ **Loại việc · Giai đoạn · Nhóm chi phí · Bộ phận** — để xem cùng một backlog dưới nhiều góc nhìn khác nhau mà không cần tạo bảng riêng.

### Lịch công việc (`/work/calendar`)

Lưới theo tháng hiển thị việc theo hạn và các mốc (milestone) của dự án. Bấm vào một việc để mở chi tiết.

### Danh mục dự án — Portfolio (`/work/portfolio`)

> **Nguyên tắc quản trị:** **PMI Portfolio Governance** — quản trị danh mục không phải là xem từng dự án tách rời, mà là nhìn **sức khỏe tổng thể của cả danh mục** để phát hiện rủi ro hệ thống (bao nhiêu dự án đỏ, bao nhiêu quá hạn, bao nhiêu đang nghẽn nguồn lực) trước khi đi sâu vào chi tiết từng dự án.

Thẻ chỉ số tổng quan (đang chạy / đỏ / quá hạn / nghẽn), biểu đồ sức khỏe danh mục, và bảng chi tiết từng dự án để drill-down khi cần.

### Thống kê đa chiều — Reports (`/work/reports`)

> **Nguyên tắc quản trị:** ra quyết định dựa trên dữ liệu tổng hợp (evidence-based management) thay vì cảm tính — một câu hỏi như "bộ phận nào đang trễ nhiều nhất ở giai đoạn nào" chỉ trả lời được bằng bảng cross-tab, không phải bằng cách lướt qua từng việc.

Chọn **trục hàng × trục cột × chỉ số** (ví dụ Bộ phận × Giai đoạn × số việc trễ hạn) để dựng bảng pivot và biểu đồ tương ứng; có thể đổi chỉ số và bấm để drill xuống danh sách việc đã lọc theo đúng ô đang xem.

> **Cách làm — Xem Gantt và baseline của một dự án**
> 1. Vào **Công việc › Dự án**, chọn một dự án trong danh sách.
> 2. Bấm nút **Gantt** trên trang chi tiết dự án.
> 3. Quan sát thanh **baseline** (mờ) và thanh **actual/forecast** (đậm) để thấy độ lệch so với kế hoạch gốc.
> 4. Thử kéo một thanh việc để đổi ngày — nếu phá vỡ phụ thuộc, hệ thống báo lỗi và tự khôi phục.

> **Cách làm — Xem thống kê đa chiều**
> 1. Vào **Công việc › Thống kê đa chiều**.
> 2. Chọn trục hàng, trục cột và chỉ số cần xem.
> 3. Bấm vào một ô trong bảng pivot để drill xuống danh sách việc tương ứng.

---

## 6. Quản trị điều hành (Management OS)

Workspace này (`/manage/*`) là nơi ban lãnh đạo **thiết lập chiến lược, theo dõi chỉ số, ra quyết định và chạy nhịp quản trị định kỳ** — tách bạch hoàn toàn với việc thực thi dự án ở mục 5. Nguyên tắc xuyên suốt: Management OS **đọc** tiến độ/dữ liệu từ Work và các hệ thống nguồn, không tạo bản sao, không ghi ngược (tránh dữ liệu trôi dạt giữa hai nơi).

### Mục tiêu chiến lược (`/manage/objectives`)

> **Nguyên tắc quản trị:** **Balanced Scorecard** (Kaplan & Norton) — chiến lược tốt phải cân bằng 4 khía cạnh thay vì chỉ chăm chăm vào tài chính: **Tài chính (Financial)**, **Khách hàng (Customer)**, **Quy trình nội bộ (Process)**, **Năng lực/Học hỏi (Capability)**. Mỗi mục tiêu chiến lược đều có một chủ sở hữu chịu trách nhiệm — không có mục tiêu "vô chủ".

Cây **StrategicObjective** theo 4 perspective trên, mỗi mục tiêu có chủ sở hữu, liên kết tới các chỉ số (metric) và sáng kiến (initiative) đo lường nó.

### Chỉ số / KPI (`/manage/metrics`)

> **Nguyên tắc quản trị:** mỗi chỉ số phải có **owner, công thức, nguồn dữ liệu, tần suất, ngưỡng và chiều hướng** rõ ràng — không có số liệu vô chủ hay số liệu không rõ cách tính.

KPI tree được xây trên `MetricDefinition` (định nghĩa chỉ số) chứ không định nghĩa lại công thức riêng. Ví dụ chỉ số **ACT-CLOSE** (tỷ lệ đóng hành động đúng hạn) được **tính trực tiếp từ dữ liệu Work thật** (việc quá hạn, việc hoàn thành) — không phải số nhập tay — nên luôn khớp với thực tế đang chạy trong hệ thống Công việc, đảm bảo số liệu đáng tin.

### Thẻ điểm — Scorecard (`/manage/scorecards`)

> **Nguyên tắc quản trị:** **quản trị theo ngoại lệ (management-by-exception)** — lãnh đạo cần thấy ngay chỗ có vấn đề, không bị một con số trung bình che khuất.

Scorecard tổng hợp theo 4 perspective, nhưng **không cho điểm gộp (blended score) che KPI đang đỏ**: mỗi cột luôn hiển thị danh sách các chỉ số/mục tiêu đang ở mức báo động (red items) cạnh điểm tổng hợp — một KR "đã đạt" nhưng KPI liên quan đang đỏ sẽ được cảnh báo mâu thuẫn thay vì bị ẩn đi.

### OKR (`/manage/okrs`)

> **Nguyên tắc quản trị:** phân biệt rõ **KPI vận hành** (đo sức khỏe lặp lại, không có "đạt/không đạt") với **OKR** (mục tiêu tham vọng theo chu kỳ, có ngày bắt đầu/kết thúc) — đây là nhầm lẫn phổ biến nhất khi tổ chức áp dụng OKR, khiến OKR biến thành danh sách việc thường ngày hoặc KPI biến thành mục tiêu tham vọng ảo.

Mỗi OKR có **Objective** định tính và các **Key Result** định lượng (baseline → hiện tại → mục tiêu) kèm **độ tin cậy (confidence)**. Key Result chỉ liên kết tới sáng kiến/hành động (Initiative/Action) để tác động outcome — **không** chứa danh sách task thô; việc thật vẫn sống trong Công việc (mục 5), tránh OKR bị biến thành một to-do list.

### Business Review (`/manage/reviews`)

> **Nguyên tắc quản trị:** một cuộc họp quản trị đúng nghĩa phải là **executable governance object** — có tài liệu đọc trước (pre-read), có ngoại lệ được nêu rõ, có quyết định, có hành động và có theo dõi sau họp — không phải một buổi báo cáo suông rồi giải tán.

Mỗi kỳ review có **pre-read** (snapshot số liệu + danh sách ngoại lệ theo màu đỏ/vàng/xanh), phần **quyết định** theo mô hình RAPID, và **hành động** phát sinh được liên kết thẳng sang việc thật trong Công việc. Khi đóng một review, trạng thái chuyển sang **"Follow-up"** hoặc **"Đã đóng"** và các follow-up được ghi nhận để kiểm tra lại ở kỳ sau.

### Quyết định — Decision Log (`/manage/decisions`)

> **Nguyên tắc quản trị:** mô hình **RAPID** (Bain & Company) — mọi quyết định quan trọng phải có **quyền quyết định rõ ràng**: ai **Recommend** (đề xuất), ai **Agree** (đồng thuận), ai **Perform** (thực thi), ai **Input** (được hỏi ý kiến), ai **Decide** (quyết định cuối) — kèm bằng chứng (evidence), hạn chót và người chịu trách nhiệm thực thi.

Nhật ký quyết định liệt kê từng quyết định với vai trò RAPID, bằng chứng đi kèm, và **độ tuổi (aging)** của các quyết định chưa xử lý — giúp lãnh đạo thấy ngay quyết định nào đang bị treo quá lâu.

### Danh mục đầu tư — Portfolio & Benefit (`/manage/portfolio`)

> **Nguyên tắc quản trị:** một **initiative** (sáng kiến đầu tư) không phải là một dự án — nó là **lý do đầu tư** (gắn mục tiêu chiến lược + lợi ích kỳ vọng), còn việc **thực thi** (ai làm gì, khi nào xong) đã có đủ ở Công việc (mục 5). Trộn hai khái niệm này khiến tổ chức không biết đang đánh giá "có nên đầu tư tiếp không" hay "dự án có đúng tiến độ không" — hai câu hỏi khác nhau, cần hai góc nhìn khác nhau trên cùng một dữ liệu thật.

Mỗi **initiative** đi qua các giai đoạn cổng (stage-gate): Tiếp nhận → Khảo sát → Đã duyệt → Đã cấp vốn → Triển khai → Rà soát lợi ích → Đóng (hoặc Dừng bất kỳ lúc nào) — chỉ đi tới, không quay lui, đúng tinh thần một quyết định đầu tư đã qua cổng thì không âm thầm lùi lại. Một initiative có thể **gắn** với một dự án thực thi đã có sẵn ở mục 5 (nút "Gắn") để xem tiến độ/sức khỏe thật — nhãn **"Nguồn: Work v2"** luôn đi kèm để không ai nhầm đây là số liệu quản trị tự nhập tay. Initiative chưa gắn dự án hiện rõ **"Chưa gắn thực thi"** — trung thực về việc "mới có ý tưởng, chưa triển khai" thay vì bịa ra một dự án giả.

Mỗi initiative có thể có nhiều **chỉ tiêu lợi ích (benefit)** — ví dụ "tăng tỷ lệ đúng hạn", "tăng điểm hài lòng khách hàng". Trạng thái của một chỉ tiêu (Đang lên kế hoạch/Đang theo dõi/Đã đạt/Không đạt) là **tự suy ra** từ số liệu chỉ số thật (KPI đã có ở `/manage/metrics`) khi chỉ tiêu đó gắn với một chỉ số đã chứng nhận — không ai được phép tự tay đánh dấu "Đã đạt". Chỉ tiêu chưa gắn chỉ số nào thì giữ nguyên "Đang lên kế hoạch" — trung thực thay vì suy đoán.

**Portfolio** (danh mục) chỉ đơn giản là một nhóm các initiative để xem tổng quan cùng lúc (bao nhiêu cái đang ở giai đoạn nào, bao nhiêu chỉ tiêu đã đạt) — không phải một tầng phê duyệt mới.

---

## 7. Nhân sự & Công

Workspace này (`/people/*`) phục vụ nghiệp vụ **nhân sự thiết yếu** cho từng nhân viên: xin nghỉ phép, xem số dư, xem lịch hiện diện của nhóm mình quản lý. Đây là chức năng nhân sự đầu tiên trên nền tảng ("PE-01") — **khác hẳn** với `/admin/users` (đó là sổ đăng ký người dùng & tài khoản của toàn nền tảng, không phải nghiệp vụ nhân sự).

> **Nguyên tắc quản trị:** ở quy mô một doanh nghiệp vừa và nhỏ (SME) chưa nối hệ thống nhân sự/lương ngoài (FinERP, Frappe HR), X.Office **tự làm nguồn dữ liệu gốc (System of Record)** cho nghỉ phép — gọi là chế độ **"SME Lite"**. Khi doanh nghiệp lớn lên và nối một hệ thống nhân sự thật, chế độ này chuyển đổi được **không cần xoá dữ liệu cũ**: dữ liệu nghỉ phép đã có sẽ tự động trở thành "bản chiếu" đọc từ hệ thống mới, người dùng không thấy gián đoạn.

### Tổng quan của tôi (`/people`)

Thẻ số dư theo từng loại nghỉ (nghỉ phép năm, nghỉ ốm, nghỉ không lương, nghỉ bù, làm việc từ xa) và danh sách đơn đang chờ xử lý của chính mình.

### Nghỉ phép (`/people/leave`)

> **Nguyên tắc quản trị:** trước khi xin nghỉ, người xin cần biết ngay **ai/việc gì sẽ bị ảnh hưởng** trong những ngày đó — nếu chờ đến lúc quản lý duyệt xong mới phát hiện có việc bị treo thì đã quá muộn. Vì vậy hệ thống **bắt buộc xem trước ảnh hưởng** trước khi cho phép gửi đơn, thay vì để người dùng gửi mù rồi xử lý hậu quả sau.

Điền loại nghỉ + khoảng ngày, bấm **"Xem trước ảnh hưởng"** — hệ thống quét thật công việc/phê duyệt/lịch đặt phòng/chỉ đạo của người xin nghỉ rơi vào khoảng đó và báo mức ảnh hưởng (Thấp/Trung bình/Cao). Chỉ sau bước này nút **"Gửi đơn"** mới bật. Đơn gửi đi **đồng thời hiện ở Trung tâm phê duyệt/Hộp việc** (mục 5) — nghỉ phép không có một hàng đợi duyệt riêng biệt, để quản lý không phải kiểm tra 2 nơi khác nhau. Đơn có thể huỷ trước khi được duyệt (huỷ ngay); đơn **đã được duyệt** muốn huỷ phải qua một bước xin huỷ (chờ quản lý xác nhận) — tránh trường hợp huỷ nghỉ ngay sát giờ làm xáo trộn kế hoạch đã sắp xếp.

### Lịch hiện diện nhóm (`/people/team/availability`)

> **Nguyên tắc quản trị & phân quyền:** đây là màn **có phạm vi dữ liệu (data scope)** — chỉ quản lý trực tiếp của một đơn vị mới thấy và duyệt được đơn của đơn vị đó, dựa trên phạm vi tổ chức thật đã cấu hình ở `/admin/data-scopes`, **không phải** ai đăng nhập cũng thấy toàn bộ nhân sự công ty. Đây là ranh giới bảo vệ dữ liệu cá nhân, không phải một giới hạn kỹ thuật tạm thời.

Chọn đơn vị (dải nút phía trên) để xem **định biên thật** (ai đang giữ vị trí nào) chồng lịch nghỉ phép, cùng danh sách đơn đang chờ duyệt của đơn vị đó với 2 nút Duyệt/Từ chối ngay tại chỗ. Nếu chọn một đơn vị **ngoài phạm vi quản lý của mình**, hệ thống báo rõ **"Ngoài phạm vi của bạn"** — đây là quyết định phân quyền có chủ đích, không phải lỗi. Muốn mở rộng phạm vi cho một người quản lý, chủ đầu tư/quản trị hệ thống cấu hình ở `/admin/data-scopes` (mục 10).

---

## 8. X.Space

Workspace **X.Space** là nơi trao đổi và cộng tác. Các màn con:

### Trang chủ X.Space (`/space/home`)

Điểm khởi đầu ngày làm việc: dải chỉ số (**Chưa đọc**, **Được nhắc đến**, **Việc cần xử lý**, **Họp hôm nay**), **Tiếp tục công việc**, **Thread đang theo dõi**, **Channel nổi bật**, **Tài liệu chia sẻ gần đây**, **Tin nhắn trực tiếp**, **Lịch họp hôm nay**, **Mục tiêu tuần**, **Quyết định đã ghim**, và thẻ **X.AI tóm tắt buổi sáng**.

### Channel triển khai (ví dụ FinERP)

Trao đổi theo channel dự án. Có hai chế độ xem trong cùng channel:

- **Hội thoại** — luồng tin nhắn của channel.
- **Tổng quan dự án** — trang tổng hợp thông tin dự án của channel.

Trong channel còn có các thành phần như **thread** (trao đổi theo chủ đề), **danh sách (lists)**, **trang channel (page)** và **huddle**.

### Channel khách hàng (360)

Channel gắn với một khách hàng, cho phép xem hồ sơ khách hàng **360 độ** ngay trong không gian trao đổi.

### Tin nhắn trực tiếp (`/space/dm/...`)

Nhắn tin 1–1 với đồng nghiệp.

> **Cách làm — Mở channel khách hàng 360**
> 1. Bấm biểu tượng **X.Space** trên thanh bên trái.
> 2. Trong bảng ngữ cảnh, chọn **Channel khách hàng (360)**.
> 3. Xem hồ sơ khách hàng cùng luồng trao đổi liên quan trong cùng một màn.

---

## 9. X.Office

Workspace **X.Office** quản lý các quy trình nghiệp vụ. Ba màn con:

### Danh mục quy trình (`/office/workflows`)

Danh sách các quy trình nghiệp vụ (mua sắm, thanh toán, tuyển dụng, ticket…). Bảng có cột **Mã / Tên**, **Mô tả**, **Chủ sở hữu**, **Node**, **Version**, **Lượt dùng** và **Thao tác**. Dải chỉ số phía trên: **Quy trình**, **Tổng số node**, **Lượt sử dụng**, **Đã publish**.

Ở mỗi dòng có nút **Tạo request** (bắt đầu một yêu cầu mới bằng biểu mẫu) và **Mở builder →** (xem/thiết kế quy trình). Nút **Tạo bằng AI** ở góc trên mở builder với trợ lý AI.

> **Cách làm — Chạy một quy trình (tạo request mới)**
> 1. Vào **X.Office › Danh mục quy trình**.
> 2. Tìm quy trình cần chạy trong bảng.
> 3. Bấm **Tạo request** ở dòng đó.
> 4. Điền **biểu mẫu** hiện ra rồi gửi. Yêu cầu sẽ tạo thành một phiên chạy (instance) và sinh việc phê duyệt tương ứng.
>
> _Nếu quy trình chưa có node biểu mẫu, hệ thống báo "Không có biểu mẫu" — khi đó dùng Giám sát vận hành hoặc bổ sung biểu mẫu trong builder._

### Vận hành · Instances (`/office/instances`)

Danh sách các **phiên chạy** quy trình. Có dải chỉ số (tổng, đang chạy) và phân trang. Bấm một dòng để mở **timeline chi tiết** của phiên đó. Nút **Giám sát vận hành →** dẫn sang màn giám sát.

### Giám sát vận hành (`/office/monitor`)

Bảng theo dõi tình trạng vận hành quy trình theo thời gian thực.

### Về X.AI Copilot

Trong X.Office, trợ lý AI có thể **gợi ý bản nháp** quy trình/biểu mẫu, nhưng **luôn cần người xác nhận** — AI không tự submit, tự duyệt hay tự publish.

---

## 10. Doanh nghiệp & Quản trị hệ thống

Workspace **Doanh nghiệp** gom dữ liệu doanh nghiệp và (với người có quyền) khu **Quản trị**.

### Khách hàng (`/customers`)

Danh mục khách hàng với dải chỉ số (**Tổng khách hàng**, phân khúc **A/B/C**, **Health TB**, **Hài lòng TB**) và bảng khách hàng. Bấm một khách hàng để mở **hồ sơ 360** (mục con **Khách hàng Minh Phát (360)** là ví dụ có sẵn).

### Tài liệu (`/documents`)

Kho tài liệu **có phiên bản** — tạo mới, thêm phiên bản, xem lịch sử và tải nội dung. Có dải chỉ số (**Tổng tài liệu**, **Phiên bản**, **Dung lượng**, **Nguồn**), bộ lọc theo **loại** và **thẻ**, ô tìm theo tiêu đề, và nút **+ Tải tài liệu**.

Nhãn nguồn cho biết dữ liệu đang **trực tiếp** (kho `/api/records`) hay **demo**.

> **Cách làm — Tạo tài liệu mới**
> 1. Vào **Doanh nghiệp › Tài liệu**.
> 2. Bấm **+ Tải tài liệu** → khay trượt mở ra.
> 3. Điền thông tin và nội dung tài liệu, rồi bấm để tạo.
> 4. Sau khi tạo xong hệ thống báo **"Đã tạo tài liệu mới"** và mở trang chi tiết của tài liệu.

> **Cách làm — Thêm phiên bản & xem lịch sử tài liệu**
> 1. Trong **Tài liệu**, bấm tên tài liệu (hoặc **Chi tiết →**) để mở trang chi tiết.
> 2. Xem dải chỉ số **Số phiên bản** và **Bản hiện hành** (ví dụ `v3`).
> 3. Trong khu **phiên bản**, xem lịch sử các phiên bản (đều **bất biến** — không sửa được bản cũ) kèm người tạo, dung lượng, mã băm (checksum).
> 4. Dùng thao tác thêm phiên bản mới để tải bản cập nhật; bản cũ vẫn được giữ nguyên trong lịch sử.

### Báo cáo (`/reports`)

Báo cáo tổng hợp: **Doanh thu tháng / 6 tháng**, **Công nợ**, **Đạt quota**, **KPI phòng ban TB**, biểu đồ doanh thu, bảng **Hiệu suất phòng ban** và **Đội ngũ kinh doanh**.

### Ứng dụng (`/apps`)

Danh mục ứng dụng và connector: **Lưới ứng dụng**, **Ứng dụng thành viên** (mở tab mới sang x1/x2/xweb…), **Instance đang triển khai**, **Tình trạng connector** và gợi ý mở rộng của X.AI. _Các connector hiện là kết nối mô phỏng (mock); việc bật/tắt tích hợp cần quản trị viên xác nhận._

### Quản trị (`/admin`) — chỉ vai trò quản trị

Nhóm **Quản trị** chỉ hiện với người có quyền quản trị tenant. Gồm 12 màn:

| Màn | Đường dẫn | Dùng để |
|---|---|---|
| Tổng quan quản trị | `/admin` | Cảnh báo cấu hình, tác vụ nhanh, kết nối hệ thống, thay đổi gần đây |
| Người dùng & thành viên | `/admin/users` | Mời, khoá, kích hoạt lại, phân vai trò (credential/MFA do IdP ngoài quản lý) |
| Sơ đồ tổ chức | `/admin/organization` | Cây đơn vị theo phiên bản có hiệu lực |
| Vị trí & người giữ | `/admin/positions` | Chức danh, người giữ hiện tại, ngày hiệu lực, tạm quyền |
| Vai trò & quyền | `/admin/roles` | Danh mục vai trò và ma trận quyền hiệu lực |
| Phạm vi dữ liệu | `/admin/data-scopes` | Định nghĩa phạm vi truy cập (ABAC), xem quyền hiệu lực, kiểm tra như một người dùng |
| Uỷ quyền & người thay | `/admin/delegations` | Uỷ quyền có thời hạn kèm phạm vi (không tự uỷ quyền/vòng lặp/vượt quyền) |
| Kiểm tra phân công | `/admin/assignment-resolver` | Mô phỏng ai sẽ được phân công/duyệt trong một ngữ cảnh |
| Quản lý backup | `/admin/backups` | Tạo và quản lý gói sao lưu logic theo tenant |
| Khôi phục (restore) | `/admin/restores` | Máy trạng thái khôi phục nhiều bước, có phê duyệt |
| Nhật ký kiểm toán | `/admin/audit` | Dòng thời gian sự kiện, before/after, chuỗi correlation |
| Cấu hình tenant | `/admin/settings/tenant` | Thông tin chung, thương hiệu, chế độ triển khai, lưu trữ/backup, bảo mật, tích hợp, feature flags |

Các màn quản trị hiển thị **nhãn nguồn**: "Dữ liệu trực tiếp" khi đã kết nối backend, hoặc "Backend chưa sẵn — demo" khi đang dùng dữ liệu mẫu.

> **Cách làm — Chạy một bản sao lưu (backup)**
> 1. Vào **Doanh nghiệp › Quản trị › Quản lý backup**.
> 2. Bấm **+ Tạo bản sao lưu** → khay trượt "Tạo bản sao lưu" mở ra, hiển thị phạm vi (LOGICAL_TENANT, mã hoá AES-256, loại trừ secret).
> 3. Bấm **Tạo bản sao lưu** để xác nhận.
> 4. Hệ thống báo **"Đã tạo bản sao lưu logical cho tenant"**; gói mới xuất hiện trong bảng với **Checksum** và **Trạng thái**.
> 5. Bấm tên gói để xem **Manifest**, **Module trong gói** và mục **Khôi phục**.
>
> _Gói backup không chứa secret/khoá. Là tác vụ chỉ dành cho quản trị viên._

> **Cách làm — Xem sơ đồ tổ chức**
> 1. Vào **Doanh nghiệp › Quản trị › Sơ đồ tổ chức**.
> 2. Xem cây đơn vị (dạng bảng, hỗ trợ bàn phím và trình đọc màn hình).
> 3. Bấm một đơn vị để xem chi tiết: thông tin đơn vị, **Vị trí & người giữ**, **Đơn vị trực thuộc** và **Lịch sử thay đổi**.

> **Cách làm — Kiểm tra ai sẽ phê duyệt trong một ngữ cảnh**
> 1. Vào **Doanh nghiệp › Quản trị › Kiểm tra phân công**.
> 2. Chọn quy trình/ngữ cảnh cần mô phỏng.
> 3. Xem người/vị trí được phân công, **danh sách ứng viên**, **lý do bị loại** và **snapshot JSON** của kết quả phân công.

> **Cách làm — Khôi phục dữ liệu từ một bản backup**
> 1. Vào **Doanh nghiệp › Quản trị › Khôi phục (restore)**.
> 2. Chọn một phiên trong **Phiên khôi phục** để xem **Máy trạng thái khôi phục** nhiều bước (sandbox → phân tích xung đột → xác minh → phê duyệt → áp dụng).
> 3. Theo dõi bước hiện tại và số **xung đột** (nếu có). Không có nút "Restore" một bước — quá trình đi qua các trạng thái và cần **phê duyệt** trước khi áp dụng.

---

## 11. Câu hỏi thường gặp & Mẹo

**Vì sao tôi không thấy khu Quản trị?**
Nhóm **Quản trị** trong workspace Doanh nghiệp chỉ hiển thị với người có quyền quản trị tenant. Nếu tài khoản của bạn không có quyền đó, các màn `/admin/*` sẽ không xuất hiện. Liên hệ quản trị viên nếu bạn cần truy cập.

**"Dữ liệu trực tiếp" và "demo" khác nhau thế nào?**
Nhiều màn hiển thị một nhãn nhỏ (chip/badge) cho biết nguồn dữ liệu: **"Dữ liệu trực tiếp"** / **"Kết nối backend"** nghĩa là đang đọc dữ liệu thật từ hệ thống; **"demo"** / **"Backend chưa sẵn"** nghĩa là đang dùng dữ liệu mẫu để minh hoạ. Ở giai đoạn hiện tại, một số phần (như các **connector** tới ERP/HR/chat) là **mô phỏng (mock)** — thao tác được ghi nhận nhưng chưa tác động sang hệ thống ngoài.

**X.AI có tự quyết định thay tôi không?**
Không. Trợ lý **X.AI** chỉ **tóm tắt, cảnh báo và gợi ý bản nháp**. Mọi quyết định phê duyệt, gửi, publish hay bật/tắt tích hợp đều **do người dùng bấm và xác nhận**.

**Tài liệu cũ có bị mất khi tôi cập nhật không?**
Không. Các phiên bản tài liệu là **bất biến** — khi bạn thêm phiên bản mới, bản cũ vẫn được giữ nguyên trong lịch sử.

**Đổi giao diện sáng/tối, mật độ ở đâu?**
Bấm **avatar** góc phải trên → **Cài đặt cá nhân**.

**Tôi muốn dùng menu đầy đủ thay vì thanh biểu tượng?**
Vào **Cài đặt cá nhân › Kiểu điều hướng** và chọn **Menu đầy đủ**.

**Cần hỗ trợ thì liên hệ ai?**
Liên hệ quản trị viên tenant X-TECH của bạn (người quản lý các màn trong khu **Quản trị**), hoặc bộ phận IT phụ trách nền tảng XHub.

---

_Tài liệu hướng dẫn người dùng — XHub / X.Space / X.Office cho X-TECH._
