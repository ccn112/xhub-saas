# PEOPLE ESSENTIALS — UI & MOBILE PLAN (PE-01)

> **Giải câu hỏi mở lớn nhất của handoff:** `docs/08_WEB_MOBILE_UX.md` và `data/UI_SCREEN_CATALOG.csv`
> liệt kê 12 route `/people/*` nhưng **không nói workspace nào sở hữu chúng**.
> Tài liệu này đưa **khuyến nghị dứt khoát** dựa trên `navigation.model.ts` đọc thực tế, + khai báo mục nav
> chính xác + phạm vi màn hình PE-01.
> Đọc kèm: `PE_API_ROUTE_PLAN.md`, `PE_CURRENT_STATE_DELTA.md` §5.

---

## 1. Trạng thái nav thực tế (đã verify)

`XHUB_NAVIGATION` có **9 mục top-level** (comment trong file vẫn ghi "5 workspaces" — đã lỗi thời):
`home` · `manage` · `work` · `space` · `office` · `business` · `platform` · `delivery` · `ioc`.

Cơ chế **entitlement** trong codebase = một `XNavItem` top-level **có `permission`**;
`filterNavByPermissions` ẩn cả cây con khi server bật enforcement. `manage`, `platform`, `delivery`, `ioc`
đều dùng đúng cơ chế này.

`xhub-web/src/app/people` **chưa tồn tại** → toàn bộ greenfield, không có route cũ phải di trú.

---

## 2. ⭐ KHUYẾN NGHỊ: `/people/*` là **workspace top-level thứ 10**, `id: "people"`, **KHÔNG gate**

### Bốn phương án đã cân nhắc

| PA | Mô tả | Đánh giá |
|---|---|---|
| **A. Nhét vào `office`** ("X.Office" — quy trình/vận hành) | Thêm nhóm "Nhân sự" dưới `office` | ❌ `office` đã có **9 mục con** (requests, my-requests, directives, service-desk, bookings, announcements, workflows, instances, monitor). Thêm 3–7 mục nữa → panel quá tải. Và ngữ nghĩa lệch: `office` là **quy trình/yêu cầu**, People là **dữ liệu cá nhân định kỳ**. |
| **B. Nhét vào `home`** (Trang chủ / Không gian của tôi) | `/home/me` mở rộng | ❌ `home` là **dashboard tổng quan**, không phải nơi chứa module nghiệp vụ có CRUD + duyệt. Và HR/Manager screens không thuộc "của tôi". |
| **C. Nhét vào `business` → nhóm `admin.console`** | Cạnh "Sơ đồ tổ chức", "Vị trí & người giữ" | ❌ Sai đối tượng nghiêm trọng. `business/admin.*` gate bằng `tenant.*`/`org.*`/`role.*` — **dành cho quản trị viên**. Nhưng `/people/leave` là màn **mọi nhân viên** dùng hằng tuần. Chôn nó dưới "Doanh nghiệp → Quản trị" là chôn tính năng dùng nhiều nhất của sản phẩm. |
| **D. Workspace top-level `people`, KHÔNG gate** ⭐ | Mục thứ 10 trên rail | ✅ **CHỌN** |

### Vì sao D — bốn lý do dựa trên chính codebase này

1. **Đối tượng người dùng là 100% nhân viên.** Rail hiện tại: mục **không gate** (`home`, `work`, `space`,
   `office`, `business`) = dành cho mọi người; mục **có gate** (`manage`, `platform`, `delivery`, `ioc`) =
   dành cho nhóm hẹp. Chấm công/nghỉ phép/phiếu lương thuộc nhóm **thứ nhất** → **không đặt `permission`
   ở cấp workspace**, chỉ gate từng mục con của Manager/HR. Đây đúng khuôn `work` đang dùng (rail mở,
   "Trung tâm phê duyệt" gate `request.approve`).
2. **Tần suất dùng cao nhất trong toàn hệ.** Xin nghỉ, xem công, xem lương là hành vi **hằng tuần/hằng tháng
   của tất cả**, cao hơn mọi module hiện có. Thứ dùng nhiều nhất phải ở tầng nông nhất.
3. **Tiền lệ đã có trong repo.** `manage` được thêm làm workspace mới (không nhét vào `business`) với lý do
   ghi rõ trong comment: *"executive workspace, distinct from operational /work/*"*. People Essentials cũng
   là **một tầng riêng biệt** (dữ liệu con người theo thời gian) — cùng lập luận, cùng cách giải.
4. **Namespace `/people/*` sạch, không va chạm.** Không đụng `/work/*`, `/manage/*`, `/office/*`, `/admin/*`,
   `/ioc/*`. Append-only vào `navigation.model.ts` — an toàn với agent IOC đang sửa cùng file.

### Vị trí trên rail
Chèn **giữa `space` và `office`** — tức mục **thứ 5/10**. Lý do: giữ nhóm "dùng hằng ngày" (`home`, `manage`,
`work`, `space`, **`people`**, `office`, `business`) liền mạch trước nhóm gated (`platform`, `delivery`, `ioc`).
Nếu ưu tiên rủi ro merge tối thiểu với agent IOC, **chèn ngay trước `platform`** cũng chấp nhận được — thứ tự
là quyết định UX, không phải kỹ thuật.

---

## 3. Khai báo nav chính xác (PE-01 — chỉ route có thật)

Luật của file: *"Only items that map to a REAL existing route are present here."*
→ PE-01 **chỉ** đăng ký 3 mục; các mục PE-02→08 thêm khi route thật ra đời.

```ts
  // ---------------------------------------------------------------------------
  // X.OFFICE PEOPLE ESSENTIALS — PE-01 "Leave & Availability" reference slice.
  // Workspace thứ 10, namespace /people/* — ADDITIVE: không đụng home/manage/work/
  // space/office/business/platform/delivery/ioc. CỐ Ý KHÔNG gate ở cấp workspace:
  // chấm công / nghỉ phép / phiếu lương là màn của MỌI nhân viên (giống `work`),
  // khác với manage/platform/delivery/ioc vốn dành cho nhóm hẹp. Mục của Manager/HR
  // mang gate riêng (people.team.* / people.hr.*) nên nhân viên thường không thấy
  // dưới AUTH_ENFORCE. Chỉ đăng ký màn có route THẬT — PE-02..08 (chấm công, bảng
  // công, timesheet, phiếu lương, hiệu suất) lên sau.
  // ---------------------------------------------------------------------------
  {
    id: "people",
    label: "Nhân sự & Công",
    icon: "customer",
    href: "/people",
    match: ["/people"],
    children: [
      { id: "people.home", label: "Tổng quan của tôi", href: "/people", icon: "me", match: ["/people"] },
      { id: "people.leave", label: "Nghỉ phép", href: "/people/leave", icon: "calendar", match: ["/people/leave"] },
      { id: "people.team.availability", label: "Lịch hiện diện nhóm", href: "/people/team/availability", icon: "customer", match: ["/people/team/availability"], permission: "people.team.availability.read" },
    ],
  },
```

**Ghi chú icon:** icon key phải phân giải được trong `src/navigation/icons`. Các key đã dùng thật trong file:
`home, chart, sales, me, bell, briefcase, inbox, approvals, work, directive, projects, apps, calendar, list,
space, channel, customer, dm, office, lifebuoy, announce, business, folder, settings, docs, guide, test`.
**Không tự chế key mới** ở PE-01 — dùng `customer` (người) + `calendar` (lịch) + `me`. Nếu muốn icon riêng
cho People, phải thêm vào registry icon **trước**, và đó là một thay đổi tách biệt.

**Cập nhật đi kèm (bắt buộc):**
- Bổ sung 3 dòng vào **MENU ROLE-VISIBILITY MAP** ở đầu `navigation.model.ts` (comment block) — file này quy
  ước mọi mục phải có mặt trong bản đồ đó.
- Sửa comment lỗi thời *"Deliberately kept to 5 workspaces"* → nêu con số thật (10). Đây là sửa **comment**,
  không phải cấu trúc — vẫn nên phối hợp thời điểm với agent IOC.

---

## 4. Màn hình web — PE-01 chỉ 3 route

| ID (handoff) | Route | Persona | Nội dung PE-01 | Gate |
|---|---|---|---|---|
| PE-W01 | `/people` | Employee/Manager | Trang chủ People: thẻ **số dư phép** theo từng loại, đơn đang chờ, đơn sắp tới, việc bị ảnh hưởng. Các thẻ Chấm công / Bảng công / Timesheet / Phiếu lương hiện dạng **"sắp có"** (`placeholder: true` — cơ chế đã có trong `XNavItem`). | — |
| PE-W03 | `/people/leave` | Employee | Danh sách đơn + form tạo đơn có **impact preview** (gọi `POST /impact-preview` trước khi submit) + chọn người thay thế + đính kèm (Records) + huỷ đơn. | — |
| PE-W07 | `/people/team/availability` | Manager | Lịch hiện diện nhóm theo `orgUnitId` + khoảng ngày; hàng đợi duyệt inline (approve/reject/request-changes); cột capacity delta. | `people.team.availability.read` |

**Hoãn sang phase sau:** PE-W02 `/people/attendance` (PE-02) · PE-W04 `/people/timekeeping` (PE-03) ·
PE-W05 `/people/timesheets` (PE-05) · PE-W06 `/people/payslips` (PE-04) ·
PE-W08 `/people/team/actions` (PE-02) · PE-W09/W10/W11 `/people/admin/*` (PE-03/04) ·
PE-W12 `/people/performance` (PE-06).

### Ràng buộc UI phải giữ
- **Không tạo hàng đợi duyệt thứ hai.** Đơn nghỉ **cũng phải** hiện ở `/approvals` (Trung tâm phê duyệt) và
  `/inbox` (Hộp việc hợp nhất) nhờ `ApprovalTask` được spawn (`PE_SOR_MATRIX_DELTA` §4).
  `/people/team/availability` là **view chuyên biệt**, không thay thế hàng đợi hợp nhất.
- **Impact preview là bắt buộc trước khi submit** (`docs/04_MODULE_LOGIC.md`): hiển thị task/milestone/
  meeting/approval/directive bị đụng, và **gợi ý tạo `Delegation`** nếu người nghỉ đang giữ `ApprovalTask` mở.
- Đủ trạng thái **empty / loading / error / 403 out-of-scope** (acceptance gate `docs/16`).
- Responsive: nền tảng đã tốt (drawer/rail/StatCard nén) — kế thừa, không tự chế layout mới.
- **Không** hiển thị bất kỳ dữ liệu lương nào ở PE-01.

---

## 5. Mobile — xác nhận thiết kế của handoff, + đính chính trạng thái

`docs/mobile/01_APP_INFORMATION_ARCHITECTURE.md` chốt: bottom nav giữ nguyên
**Hôm nay · Công việc · Hành động · X.Space · Cá nhân**; People Essentials xuất hiện **theo ngữ cảnh**
(Today card · Action Center · Quick Create · Cá nhân · Manager capacity card); **không tạo tab "Nhân sự" ở MVP**.

✅ **Xác nhận thiết kế này ĐÚNG và nên giữ.** Lý do: bottom nav 5 tab đã kín; nghỉ phép là hành vi
**thưa nhưng gấp** (vài lần/tháng, cần làm nhanh) → hợp với entry theo ngữ cảnh (Quick Create + Action Center)
hơn là một tab thường trực.

### ⚠️ Đính chính trạng thái — **app mobile XHub chưa tồn tại**

Verify: `D:\Code` chỉ có `handoff`, `x1`, `x2`, `xhub` (repo tài liệu/nghiên cứu), `xhub-saas`, `xweb`.
Trong `xhub-saas` chỉ có `xhub-api` + `xhub-web`. **Không có project Flutter/React Native nào của XHub.**
(`x1`, `x2` là app di động của **sản phẩm khác** — Meyland và X2-BMS — không phải XHub.)

➡️ Hệ quả: phần mobile của PE-01 (`PE-013` trong backlog) **không phải build app**, mà là **chốt hợp đồng**
để app tương lai không phải thiết kế lại:

| Hạng mục | Nội dung chốt ở PE-01 |
|---|---|
| **Deep link** | Giữ nguyên `data/UI_SCREEN_CATALOG.csv`: `app://people/leave/new` (PE-M02), `app://actions/leave/{id}` (PE-M03), `app://people/team/capacity` (PE-M07). |
| **API** | Mobile dùng **cùng** `/api/people/*`, không có endpoint riêng. |
| **Idempotency** | Client sinh `idempotencyKey` (uuid v4) lưu cùng form draft — bắt buộc cho mạng chập chờn. |
| **Offline** | Đơn nghỉ soạn offline lưu ở trạng thái `DRAFT` phía client; chỉ POST khi có mạng; retry dùng lại đúng key. |
| **Payload nhẹ** | `impact-preview` trả `summary` gọn (`{ workItems: 3, approvals: 1, riskLevel }`) tách khỏi danh sách id đầy đủ. |
| **Không đưa lên mobile** | Policy builder, import builder, khoá kỳ công (`docs/08` nêu rõ). |

---

## 6. Checklist trước khi code UI (Constitution #12)

- [x] Domain contract — `PE_SCHEMA_PLAN.md`
- [x] SoR — `PE_SOR_MATRIX_DELTA.md`
- [x] State machine — `docs/03_STATE_MACHINES.md` + FSM enforce trong service
- [ ] **Seed manifest — `PE_TEST_PLAN.md` §2 (phải chạy được TRƯỚC khi render màn đầu tiên)**

➡️ **Không mở file `.tsx` nào cho tới khi seed + smoke của PE-01 PASS.**
