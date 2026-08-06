# XHub / X.Space / X.Office — Developer Guide

> Tài liệu dành cho developer join vào nền tảng. Viết dựa trên **code thực tế** của hai
> repo (`xhub-web`, `xhub-api`) và bộ design system Tailux đã mua. Đồng bộ với
> `PROJECT_STATUS_XHUB.md` (báo cáo tình trạng, cập nhật 2026-07-29).
>
> Nguyên tắc khi đọc: mọi đường dẫn file / tên script / biến môi trường trích trong
> guide này đều tồn tại trong repo tại thời điểm viết. Khi code và tài liệu mâu thuẫn,
> **code là chân lý** — xem mục [Sai lệch với PROJECT_STATUS](#phụ-lục-sai-lệch-với-project_status).

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Chạy dự án (local)](#2-chạy-dự-án-local)
3. [Design system Tailux](#3-design-system-tailux)
4. [Điều hướng (nav)](#4-điều-hướng-nav)
5. [Thêm một màn hình mới](#5-thêm-một-màn-hình-mới)
6. [Form "thêm mới" & mutations](#6-form-thêm-mới--mutations)
7. [Backend: giải phẫu một module](#7-backend-giải-phẫu-một-module)
8. [Auth & authz](#8-auth--authz)
9. [Kiểm thử & gate](#9-kiểm-thử--gate)
10. [Quy ước & cạm bẫy](#10-quy-ước--cạm-bẫy)
    - [10.5 Hỗ trợ khách hàng sản phẩm](#105-hỗ-trợ-khách-hàng-sản-phẩm-product-customer-support--06082026)
11. [Tài liệu liên quan](#11-tài-liệu-liên-quan)

---

## 1. Tổng quan kiến trúc

Nền tảng làm việc hợp nhất cho X-TECH, gồm ba "mặt":

- **XHub** — workspace điều hành (dashboards, hộp việc, phê duyệt, dự án).
- **X.Space** — collaboration kiểu Slack (channel / thread / DM / huddle).
- **X.Office** — workflow / eForm engine + AI Copilot (draft-first, human confirm).

### Hai repo

| Thành phần | Repo | Stack | Port |
|---|---|---|---|
| Frontend | `D:\Code\xhub-web` | Next.js **16.2** App Router + React 19 + Tailwind v4 + design system **Tailux** (mua) | **3000** (`next dev`) |
| Backend / BFF | `D:\Code\xhub-api` | NestJS + Prisma **7** + Postgres (`xhub`) + `@anthropic-ai/sdk` | **4000** (`PORT` env) |
| Nghiên cứu / ADR | `D:\Code\xhub` | Docs + contracts | — |
| Handoff (nguồn) | `D:\Code\handoff\xhub\*` (symlink Google Drive) | Tailux theme, procedures | — |

### Nguyên tắc kiến trúc (bất biến)

1. **FE không bao giờ chạm DB.** Mọi truy cập dữ liệu đi qua BFF (`xhub-api`) qua
   `XHUB_API_URL` (mặc định `http://localhost:4000`). Điều này được nhắc lại trong
   từng file `*.server.ts` và proxy route handler.
2. **Tenant scope mọi query.** Backend dùng Postgres Row-Level Security (RLS) pin
   theo `app.current_tenant` — xem [§7 RLS](#rls-row-level-security).
3. **System of Record (SoR) ownership.** Mỗi thực thể có đúng một hệ thống chủ. X.Office
   *office-owned*; lệnh sang FinERP/HR là **delegated command** (connector), không
   dual-write, không tái tạo master. Không bịa object ERP giả (dùng `ExternalExecution`
   MANUAL_TASK khi chưa nối thật).
4. **AI draft-first.** AI chỉ hỗ trợ đọc / tóm tắt / soạn nháp; không tự
   submit/approve/publish.
5. **Version published là immutable** (append-only).

### Luồng request

```mermaid
flowchart LR
  B[Browser] -->|1. điều hướng| SC[Next.js Server Component<br/>src/app/**/page.tsx]
  B -->|2. mutation POST| RH[Route Handler<br/>src/app/api/**/route.ts]
  SC -->|fetch qua *.server.ts<br/>headers x-tenant-id/x-user-id| API
  RH -->|forwardPost + identity headers| API[xhub-api NestJS :4000]
  API -->|IdentityGuard → PermissionGuard| CTRL[Controller]
  CTRL --> SVC[Service]
  SVC -->|prisma.withTenant tenantId| DB[(Postgres + RLS)]
  DB -->|SET LOCAL app.current_tenant<br/>policy lọc theo tenant| SVC
  API -->|JSON + {source: live}| SC
  SC -->|props| CC[Client Component<br/>DataTable/StatCard/...]
```

- **Đọc:** Server Component gọi một BFF client `*.server.ts` (ví dụ
  `src/features/documents/records.server.ts`) → `fetch` sang `xhub-api` với header
  identity → trả về view model + cờ `source: "live" | "demo"`. Nếu API lỗi/rỗng thì
  **degrade** về seed demo (không crash).
- **Ghi:** Client Component `POST` vào một route handler nội bộ
  (`src/app/api/**/route.ts`) → route handler `forwardPost` sang `xhub-api` với header
  identity → toast + `router.refresh()`.

---

## 2. Chạy dự án (local)

### Prerequisites

- **Node.js** (khớp Next 16 / React 19 — Node 20 LTS trở lên).
- **PostgreSQL** đang chạy, có database `xhub`.
- File `.env` cho backend (xem `xhub-api/.env.example`) và `.env.local` cho frontend.

### Frontend (`xhub-web`)

```bash
cd D:/Code/xhub-web
npm install
npm run dev      # next dev → http://localhost:3000
npm run build    # next build (gate: exit 0)
npm start        # next start (prod)
npm run lint     # eslint
```

`.env.local` tối thiểu:

```env
XHUB_API_URL=http://localhost:4000
NEXT_PUBLIC_XHUB_API_URL=http://localhost:4000
```

> `XHUB_API_URL` được dùng server-side (trong `*.server.ts` và route handler).
> `NEXT_PUBLIC_*` chỉ dùng khi cần gọi từ client (hiếm; hầu hết đi qua route handler).

### Backend (`xhub-api`)

```bash
cd D:/Code/xhub-api
npm install
npm run start:dev            # nest start --watch → :4000 (cần Postgres + .env)
npm run build                # nest build → dist/
node dist/src/main.js        # chạy bản build (KHÔNG dùng npm run start:prod — xem lưu ý)
```

> ⚠️ **`start:prod` trỏ SAI.** `package.json` định nghĩa `"start:prod": "node dist/main"`,
> nhưng `nest build` sinh ra `dist/src/main.js`. Luôn chạy **`node dist/src/main.js`**.

Cấu hình Prisma 7: URL kết nối nằm ở `prisma.config.ts` (không còn trong `schema.prisma`),
đọc `DATABASE_URL` từ `.env` qua `dotenv/config`:

```ts
// prisma.config.ts
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: { url: process.env.DATABASE_URL },
});
```

### Thiết lập DB / RLS / seed

```bash
npm run rls:setup      # ENABLE + FORCE RLS + policies (chạy khi tạo DB / thêm bảng)
npm run db:seed        # seed X.Office (workflow/version/form...)
npm run seed:records   # seed 6 tài liệu cho module Records/Documents
```

> `DATABASE_URL` phải **percent-encode** mật khẩu (ví dụ `@` → `%40`) vì là URL.

---

## 3. Design system Tailux

FE dựng trên bộ theme Tailux (Tailwind v4) mua ngoài, nguồn demo tại
`D:\Chinh\tailux\ts\demo` *(sửa lại 05/08/2026 — đường dẫn cũ `D:\Code\handoff\xhub\tailux\...`
không còn tồn tại trên máy hiện tại)*. Nguyên tắc port: **không sửa file Tailux gốc**;
XHub tạo lớp adapter + kit riêng (`src/xhub/ui`) style theo Tailux, và override token
thương hiệu ở `src/app/globals.css`.

### 3.1 Cách port theme

- `src/styles/index.css` (import từ Tailux) định nghĩa `@theme` tokens, class component
  (`.btn/.card/.badge`), layouts, và biến dark.
- `src/app/globals.css` **layer thương hiệu lên trên**: font + primary color:

```css
@import "../styles/index.css";
@theme {
  --font-sans: var(--font-inter), Inter, ui-sans-serif, system-ui, sans-serif, ...;
  --font-heading: var(--font-jakarta), "Plus Jakarta Sans", var(--font-inter), ...;
  /* Brand primary = blue600 #1769E0 thay cho indigo mặc định của Tailux */
  --color-primary-600: #1769e0;
  /* ...primary-50..950 */
}
```

- **Token families:** `--color-primary-*` (50–950), `--color-dark-*` (nền dark, có
  `dark-450/500/700/750`), `--color-gray-*` (có `gray-150`), semantic
  `success/warning/error/info/secondary` (mỗi bộ có `-lighter/-light/-darker`), surface
  `--color-surface-1/2/3`, shadow `--shadow-soft`.
- **Dark mode:** class-based — Tailux khai báo `@custom-variant dark (&:is(.dark *))`;
  bật bằng class `.dark` trên `<html>`. Palette có thể swap độc lập qua data-attribute
  `data-theme-primary` / `data-theme-light` / `data-theme-dark`.
- **Fonts:** body = Inter (`--font-inter`), heading = Plus Jakarta Sans
  (`--font-jakarta`); class `.font-heading` áp cho h1–h6.
- **A11y:** Tailux đặt `outline: none` toàn cục → `globals.css` phục hồi ring focus cho
  `:focus-visible` (chỉ khi điều hướng bằng bàn phím).

### 3.2 Component catalog — XHub kit ↔ Tailux

Kit XHub nằm ở `src/xhub/ui/*` (đọc/hiển thị) và `src/xhub/ui/form/*` (nhập liệu). Bảng
dưới map từng component sang pattern Tailux tương ứng và doc gốc dưới
`D:\Chinh\tailux\ts\demo\public\md\...`.

| XHub component | File | Backed bởi (Tailux) | Doc gốc | Usage một dòng |
|---|---|---|---|---|
| `Card` / `SectionCard` | `src/xhub/ui/Card.tsx` | `.card` + `--shadow-soft`; header accent theo priority | `components/*` (Box) | `<SectionCard title="…" accent="warning">…</SectionCard>` |
| `DataTable` | `src/xhub/ui/DataTable.tsx` | `Table` (`Tr/Th/Td`), biến thể hoverable/zebra | `tables/basic-table/{Basic,Hoverable,Zebra,Dense}.md` | `<DataTable columns={cols} rows={rows} rowKey={r=>r.id}/>` |
| `Pagination` / `PaginatedTable` | `src/xhub/ui/Pagination.tsx`, `PaginatedTable.tsx` | pagination pattern | `components/pagination/Basic.md` | `<Pagination page={p} pageSize={s} total={n} onPageChange=… />` |
| `StatCard` | `src/xhub/ui/StatCard.tsx` | KPI tile trên `.card` | dashboards demo | `<StatCard label="Quá hạn" value="3" tone="error" icon="⏰"/>` |
| `Badge` | `src/xhub/ui/Badge.tsx` | `Badge` (color/variant) | `components/badge/Basic.md` | `<Badge tone="success">Hoàn tất</Badge>` |
| `AiRecap` | `src/xhub/ui/AiRecap.tsx` | alert/notification pattern (primary tint) | `components/{alert,notification}` | `<AiRecap points={[…]} />` (X.AI tóm tắt, read-only) |
| charts | `src/xhub/ui/charts/{Area,Bar,Donut}Chart.tsx` | Tailux charts | `components/charts` | dùng trong dashboard |
| `TextField`/`TextareaField`/`SelectField` | `src/xhub/ui/form/Fields.tsx` | `Input`/`Textarea`/`Select` (`src/components/ui/Form/*`) | `forms/{input,textarea,select}` | `<TextField label="Tên" name="name" required/>` |
| `SwitchField` | `src/xhub/ui/form/Fields.tsx` | `Switch` (Headless UI) | `forms/switch` | `<SwitchField label="Bật" checked={v} onChange={setV}/>` |
| `FormDrawer` | `src/xhub/ui/form/FormDrawer.tsx` | Drawer (Headless UI `Dialog`+`Transition`, slide phải) | `components/drawer/Right.md` | `<FormDrawer open title onSubmit>…</FormDrawer>` |
| `FormSection` | `src/xhub/ui/form/FormSection.tsx` | nhóm field trong form demo | `forms/*` | `<FormSection title="Thông tin">…</FormSection>` |
| `ConfirmDialog` | `src/xhub/ui/ConfirmDialog.tsx` | `ConfirmModal` (pending→confirming→error) | `components/modal/*` | `<ConfirmDialog open title description onConfirm/>` — mọi xoá đều bắt buộc qua đây (chốt 05/08/2026, xem `docs/design-system/TAILUX_PAGE_PATTERNS.md` quy tắc 3); thêm `typedConfirmation={{code}}` cho dữ liệu tài chính/nhạy cảm |

> Kit form (`src/xhub/ui/form/index.ts`) export: `TextField, TextareaField, SelectField,
> SwitchField, FormDrawer, FormSection`. `FormDrawer` mirror pattern của
> `src/components/navigation/SettingsDrawer.tsx` (cùng dùng Headless UI Dialog/Transition).

Control base của field (để đồng bộ khi tự viết input):

```
w-full rounded-lg border bg-white px-3 py-2 text-sm ... focus:ring-2 focus:ring-primary-500/40 ... dark:bg-dark-700
```

### 3.3 Pattern Tailux giàu hơn cho màn hình tương lai

Demo Tailux còn nhiều pattern chưa port, tham khảo khi dựng màn mới
(`D:\Chinh\tailux\ts\demo\src\app\pages\`):

- **tables/** — `advanced-table`, `*-datatable-*`, `react-table` (sort/filter/column).
- **forms/** — `form-validation`, `add-product-form`, `KYCForm`, `datepicker`,
  `file-upload`/`filepond`, `autocomplete`, `listbox`, `input-mask`, `text-editor`.
- **apps/** — `filemanager` (tham khảo cho Tài liệu), `kanban`, `mail`, `chat`,
  `ai-chat`, `pos`.
- **prototypes/** — `invoice-1/2`, `post-details`, `onboarding-*`, `help-*`,
  `price-list-*`, `sign-in/up`.
- Component đơn (doc dưới `public/md/components/`): `accordion, alert, avatar, badge,
  button, carousel, charts, collapse, drawer, dropdown, modal, notification, pagination,
  popover, progress, skeleton, spinner, steps, tab, tag, timeline, tooltip, treeview`.
  Lưu ý một số là **markup thuần** (steps: `<ol class="steps"><li class="step">`),
  hoặc **attribute-driven** (tooltip: `data-tooltip data-tooltip-content="…"`).

### 3.4 Content & UX pattern cấp-trang (không chỉ component)

Mục 3.2/3.3 ở trên map **component**. Riêng cách Tailux **bố trí nội dung** và **trải nghiệm
người dùng** ở cấp độ cả trang (thứ tự khối, hành vi loading/xoá/rỗng, câu chữ mẫu) cho 6 dạng
trang hay gặp nhất — Trang chủ/Dashboard, Danh sách, Chi tiết, Form popup, Form điều hướng riêng
trang (wizard), Form tạo mới đơn giản — được ghi riêng ở
[`docs/design-system/TAILUX_PAGE_PATTERNS.md`](./design-system/TAILUX_PAGE_PATTERNS.md).
**Đọc file đó trước khi dựng bất kỳ trang mới nào** — đây là phần Tailux đầu tư nhiều nhất, dễ bỏ
sót nếu chỉ nhìn theo component đơn lẻ.

### 3.5 Đa ngôn ngữ (i18n) — hạ tầng chuẩn, 05/08/2026

Thư viện: [`next-intl`](https://next-intl.dev) v4. **Cố ý KHÔNG dùng URL prefix** (`/vi/...`,
`/en/...`) — với ~150 route hiện có, thêm prefix nghĩa là viết lại toàn bộ route/link. Thay vào đó,
ngôn ngữ đọc từ **cookie** `NEXT_LOCALE` (mặc định `vi`), mọi URL/link giữ nguyên y hệt.

- `src/i18n/locales.ts` — danh sách locale hỗ trợ (`vi`, `en`), locale mặc định, nhãn hiển thị.
- `src/i18n/request.ts` — `getRequestConfig` đọc cookie, nạp đúng `messages/<locale>.json`.
- `src/i18n/actions.ts` — Server Action `setLocale()` ghi cookie (gọi từ Client Component, xong
  `router.refresh()` — không cần tải lại trang, không đổi URL).
- `messages/vi.json` / `messages/en.json` — namespace hiện có: `settings` (nhãn khu vực đổi ngôn
  ngữ), `nav` (toàn bộ 123 nhãn menu), `home` (trang `/home/executive`), `sales` (cụm Kinh doanh:
  Khách hàng/Cơ hội/Danh mục/Hợp đồng/KPI).
- Đổi ngôn ngữ ở đâu: Cài đặt cá nhân (icon bánh răng trên header) → mục **Ngôn ngữ**
  (`src/components/navigation/SettingsDrawer.tsx`) — cùng kiểu áp dụng ngay như Giao diện/Mật độ.

**⚠️ Quy tắc đặt tên key bắt buộc — KHÔNG dùng dấu chấm trong key:** `next-intl` luôn hiểu dấu chấm
trong key là **phân cấp namespace lồng nhau**, không phải ký tự literal. Nếu đặt 2 key
`"office": "X.Office"` và `"office.customers": "Khách hàng"` trong CÙNG 1 namespace phẳng,
`t("office.customers")` sẽ lỗi `MISSING_MESSAGE` (vì `office` đã là chuỗi lá, không thể đi tiếp vào
`.customers`) — lỗi này ĐÃ xảy ra thật khi dựng `nav` namespace (123 key từ `id` của
`navigation.model.ts`, nhiều id có dấu chấm như `office.customers`). Cách khắc phục đã dùng: đổi
toàn bộ dấu `.` trong key thành `_` (`office_customers`), giữ dấu gạch ngang bình thường (`office_ai-systems` không sao vì `-` không có ý nghĩa đặc biệt). Khi thêm key mới, **không copy nguyên `id`
có dấu chấm làm key** — luôn thay `.` bằng `_` trước.

**Component nào là Server, component nào là Client:**
- Server Component (trang `.tsx` không có `"use client"`, kể cả `async function`): dùng
  `getTranslations(namespace)` từ `next-intl/server` — `const t = await getTranslations("sales")`.
- Client Component (`"use client"`, ví dụ nav renderer, `SettingsDrawer`): dùng
  `useTranslations(namespace)` từ `next-intl` — `const t = useTranslations("nav")`.

**Phạm vi ĐÃ chuyển đổi** (chỉ phần này đổi ngôn ngữ khi bấm chuyển — phần còn lại của app vẫn hiển
thị tiếng Việt cứng cho tới khi được chuyển đổi tiếp, đây là chủ đích, không phải thiếu sót):
menu điều hướng (toàn bộ, 5 file render + `navigation.model.ts`), `/home/executive` (chữ giao diện
— tiêu đề/nhãn/tên cột; **không** đụng tới dữ liệu mẫu/seed hiển thị bên trong, ví dụ tên chỉ đạo,
nội dung X.AI tóm tắt — đó là dữ liệu nghiệp vụ, không phải chữ giao diện), 5 trang danh sách cụm
Kinh doanh (`/office/customers`, `/office/opportunities`, `/office/catalog`, `/office/contracts`,
`/office/revenue-kpi` — tiêu đề/mô tả/tên cột/nút/trạng thái rỗng).

**Cố ý CHƯA chuyển đổi** (mở rộng dần ở các đợt sau, không phải lỗi):
- Trang chi tiết của cụm Kinh doanh (`/office/customers/[id]`, `/office/opportunities/[id]`,
  `/office/contracts/[id]`) và các client component hành động (`CustomerActions`, `ContractActions`,
  `OpportunityActions`).
- Nhãn enum trạng thái nằm trong các file `*-data.ts` (`CUSTOMER_STATUS_LABEL`,
  `OPPORTUNITY_STAGE_LABEL`, `CONTRACT_STATUS_LABEL`) — hiện vẫn là chuỗi tiếng Việt cứng, chưa nối
  vào `messages/*.json`.
- 3 trang `/home/sales`, `/home/me` và toàn bộ ~140 trang còn lại của app.

**Cách mở rộng cho trang mới:** thêm namespace/key vào CẢ `messages/vi.json` lẫn `messages/en.json`
(giữ đúng key giống nhau ở cả 2 file — không có công cụ kiểm tra thiếu key tự động ở đợt này), rồi
gọi `getTranslations`/`useTranslations` đúng theo loại component ở trên.

---

## 4. Điều hướng (nav)

### 4.1 ONE model — 5 workspace

Toàn bộ điều hướng bắt nguồn từ **một** cây duy nhất:
`src/xhub/nav/navigation.model.ts` → hằng `XHUB_NAVIGATION: XNavItem[]`.

- Level-1 = **workspace** (rail icon), cố ý giữ đúng **5**:
  1. `home` — Trang chủ (dashboards + Thông báo)
  2. `work` — Công việc (Hộp việc / Phê duyệt / Chỉ đạo / Dự án)
  3. `space` — X.Space (collaboration)
  4. `office` — X.Office (quy trình / vận hành)
  5. `business` — Doanh nghiệp (Khách hàng / Tài liệu / Báo cáo / Ứng dụng / Quản trị)
- Màn thật nằm **một cấp con**, render ở prime (context) panel. Rail chỉ là nhóm cha.
- **Chỉ item có route thật mới được có mặt** trong model (item chưa có màn thì bỏ, không
  để rò ra DOM).

Kiểu dữ liệu (`XNavItem`): `id, label, icon?, href, match?, permission?, entitlement?,
badgeKey?, placeholder?, children?`.
- `href` = target điều hướng thật.
- `match` = base paths để suy ra active state (mặc định `[href]`).
- `badgeKey` = **KEY**; giá trị số do badge resolver tính (không hardcode).

### 4.2 Rail + prime panel + mobile đều derive từ model

Các renderer trong `src/components/navigation/` **không tự định nghĩa cây**, mà đọc chung:

- `railTreeAdapter.ts` — `toRailTree(XHUB_NAVIGATION)` chuyển `XNavItem` sang shape
  `NavigationTree` của Tailux MainLayout (`type: "root" | "collapse" | "item"`), để rail +
  context panel Tailux dùng cùng model mà không phải sửa file Tailux.
- `RailContextNavigation.tsx` — rail icon (level-1) + panel con.
- `ExpandedSidebarNavigation.tsx` — sidebar mở rộng (chế độ `expanded`).
- `MobileBottomNavigation.tsx` — bottom-nav mobile.
- `NavigationProvider.tsx` + `use-navigation-mode.ts` — chế độ `rail-context` /
  `expanded` (server-authoritative preference qua `/api/me/ui-preferences`).
- `NavigationModeRenderer.tsx` — chọn renderer theo mode.

**Active state** do một resolver duy nhất tính (`src/xhub/nav/resolver.ts`):
`isItemActive` / `isBranchActive` / `findActivePrimary` / `isLeafActive` — không renderer
nào tự tính active.

**Badge** do `src/xhub/nav/badges.ts` (`resolveBadges` → `{ "inbox.open": n,
"approval.pending": n, "space.unread": n }`), derive từ seed tenant-scope; renderer chỉ
đọc `badgeValue(badges, item.badgeKey)`.

**Icon registry:** `src/navigation/icons.tsx` — key hợp lệ: `home, inbox, space, work,
approvals, projects, apps, office, ai, settings, chart, sales, me, channel, customer, dm,
folder, list, bell, business, briefcase` (Heroicons + Tailux icon).

### 4.3 Thêm một screen/menu vào nav

1. Xác định **workspace cha** (một trong 5). Nếu screen thuộc nhóm con (vd
   `admin.console`) thì thêm vào `children` của nhóm đó.
2. Thêm một `XNavItem` con:
   ```ts
   { id: "reports.pnl", label: "Báo cáo P&L", href: "/reports/pnl",
     icon: "chart", match: ["/reports/pnl"], permission: "report.view" }
   ```
3. Đảm bảo `icon` là key có trong `icons.tsx` (thêm mới nếu cần).
4. Nếu cần badge, đặt `badgeKey` và bổ sung tính toán trong `resolveBadges`.
5. **Chỉ thêm khi route đã tồn tại** — nếu chưa có màn, dùng `placeholder: true` hoặc để
   sau (tránh link chết).

---

## 5. Thêm một màn hình mới

Template chuẩn (theo `inbox` / `documents` / `admin`): **Server Component fetch qua BFF
client → truyền props xuống Client Component render kit**.

### 5.1 BFF client `*.server.ts`

Đặt trong `src/features/<module>/<name>.server.ts`, mở đầu bằng `import "server-only"`,
trả về view model + cờ `source`, và **degrade** khi API lỗi/rỗng. Ví dụ rút gọn từ
`src/features/documents/records.server.ts`:

```ts
import "server-only";
const API = process.env.XHUB_API_URL || "http://localhost:4000";
const HEADERS = { "x-tenant-id": "tenant-xtech", "x-user-id": "user-nam" } as const;
export type Source = "live" | "demo";

export async function fetchDocuments(filter?: DocumentFilter): Promise<DocumentsListResult> {
  try {
    const res = await fetch(`${API}/api/records${suffix}`, { headers: HEADERS, cache: "no-store" });
    if (!res.ok) return demoData();
    const rows = (await res.json()) as ApiDoc[];
    if (!Array.isArray(rows) || rows.length === 0) return demoData();
    return { source: "live", documents: rows.map(normalizeDoc), versionCount, byteSize };
  } catch {
    return demoData();     // FE không bao giờ crash vì backend
  }
}
```

Điểm cần theo:
- `cache: "no-store"` (dữ liệu tenant động) + `export const dynamic = "force-dynamic"` ở
  page khi đọc live.
- Header identity `x-tenant-id` / `x-user-id` (demo: `tenant-xtech` / `user-nam`).
- Luôn **normalize** shape API → view model FE riêng (đừng để component phụ thuộc shape
  backend).

### 5.2 Server Component (`page.tsx`)

```tsx
// src/app/(app)/inbox/page.tsx (rút gọn)
export const dynamic = "force-dynamic";      // đọc SoR projection live
export const metadata = { title: "Hộp việc hợp nhất · XHub" };

export default async function InboxPage() {
  const projection = await fetchProjection();     // BFF, [] khi lỗi
  const items = [...projection, ...seedItems];     // merge demo giữ đa dạng
  return (
    <div className="space-y-4">
      <h1 className="font-heading text-xl font-bold …">Hộp việc hợp nhất</h1>
      <InboxClient items={items} />
    </div>
  );
}
```

### 5.3 Client Component render kit

Client Component (`"use client"`) dùng kit: `StatCard` (KPI), filter/search,
`SectionCard` + `DataTable` + `Pagination`, **source chip**, empty state. Xem
`src/app/(app)/inbox/InboxClient.tsx`:

- KPI: `<StatCard label="Quá hạn" value=… tone="error" icon="⏰"/>` trong grid.
- Bảng: `columns: Column<T>[]` với `cell: (row) => ReactNode`; `<DataTable rows={paged}
  rowKey={r=>r.id} onRowClick=… empty={<EmptyState/>} />`.
- Phân trang client-side: `visible.slice((page-1)*pageSize, …)` + `<Pagination …/>`.
- **Source chip:** hiển thị nguồn dữ liệu (vd `<Badge tone="info">SoR: {sourceSystem}</Badge>`
  cho item live; page text đổi theo `projection.length`).

### 5.4 AppShell

Mọi màn nằm trong route group `(app)`, bọc bởi `AppShell`
(`src/components/navigation/AppShell.tsx`): layout `h-dvh` flex-column — Header (cố định) ·
`main` (`flex-1 min-h-0 overflow-y-auto`, tự scroll) · Footer (không bị đẩy). `DataTable`
tự giới hạn chiều cao `max-h-[calc(100dvh-19rem)]` để bảng dài không đẩy footer khỏi màn.

---

## 6. Form "thêm mới" & mutations

### 6.1 Form kit

Dùng `FormDrawer` (slide-over) + các Field từ `src/xhub/ui/form`:

```tsx
"use client";
import { FormDrawer, FormSection, TextField, SelectField, SwitchField } from "@/xhub/ui/form";

<FormDrawer
  open={open} onClose={() => setOpen(false)}
  title="Tạo backup" description="Xuất dữ liệu tenant (RLS-scoped)."
  submitting={pending} submitDisabled={!valid}
  onSubmit={handleSubmit}
  footnote={source === "demo" ? <p className="text-xs text-warning">Chế độ demo…</p> : null}
>
  <FormSection title="Thông tin">
    <TextField label="Nhãn" name="label" required />
    <SelectField label="Kiểu" name="kind" options={KIND_OPTS} placeholder="Chọn…" />
    <SwitchField label="Mã hoá" checked={enc} onChange={setEnc} />
  </FormSection>
</FormDrawer>
```

- `FormDrawer` bọc một `<form onSubmit>` thật; nút submit hiện spinner khi `submitting`,
  disable khi `submitDisabled`.
- Field hiển thị `label / required(*) / hint / error` và ring focus `primary-500`.

### 6.2 BFF proxy route handler

Mutation KHÔNG gọi thẳng `xhub-api` từ client — đi qua route handler nội bộ để giấu API
base + gắn header identity server-side. Pattern chuẩn dùng
`src/app/api/admin/_forward.ts`:

```ts
// _forward.ts
const API = process.env.XHUB_API_URL ?? "http://localhost:4000";
const HEADERS = { "content-type": "application/json",
  "x-tenant-id": "tenant-xtech", "x-user-id": "user-nam" } as const;

export async function forwardPost(path: string, body: unknown): Promise<Response> {
  try {
    const res = await fetch(`${API}${path}`, { method: "POST", headers: HEADERS,
      body: JSON.stringify(body ?? {}), cache: "no-store" });
    const data = /* parse */;
    if (!res.ok) return Response.json({ error: "backend rejected", detail: data }, { status: res.status });
    return Response.json(data ?? { ok: true });
  } catch {
    return Response.json({ error: "backend unavailable" }, { status: 502 });
  }
}
```

```ts
// src/app/api/records/route.ts
import { forwardPost, readJson } from "../admin/_forward";
export async function POST(request: Request) {
  const body = await readJson(request);
  return forwardPost("/api/records", body);      // → xhub-api POST /api/records
}
```

### 6.3 Client wiring: toast + refresh + degrade

Trong handler client: `fetch("/api/records", { method: "POST", body })` → nếu ok:
`toast.success(...)` + `router.refresh()` (revalidate server component, bảng cập nhật) và
đóng drawer. Nếu endpoint chưa có (`502` / `404`) → hiện **degrade demo** an toàn (thông
báo "chế độ demo", không đụng DB) như các màn admin chưa có backend
(audit/delegations/tenant-settings).

---

## 7. Backend: giải phẫu một module

### 7.1 NestJS module/service/controller

Một module điển hình (`src/records/`):

```
records.module.ts       // @Module: providers [RecordsService, StorageService], controllers [RecordsController]
records.controller.ts   // @Controller('api/records') — HTTP surface
records.service.ts       // business logic, gọi prisma.withTenant
storage.service.ts       // object storage (folder-per-tenant)
dto/                     // DTO validate input
```

Route của `RecordsController` (`@Controller('api/records')`):
`POST /`, `GET /`, `GET /:id`, `POST /:id/versions`, `GET /:id/versions/:versionNo/content`.

### 7.2 Prisma 7 + adapter-pg

- `PrismaService extends PrismaClient` (`src/prisma/prisma.service.ts`); Prisma 7 bắt buộc
  driver adapter → `new PrismaPg({ connectionString: process.env.DATABASE_URL })`.
- URL kết nối ở `prisma.config.ts` (không trong `schema.prisma`).
- `schema.prisma`: **41 model** tổng. Nhóm theo domain:
  - X.Office: `Tenant, Workflow, WorkflowVersion, WorkflowNode, WorkflowEdge,
    WorkflowInstance, ConnectorCommand, ExternalExecution, ApprovalTask, Delegation,
    Notification, WorkflowEvent, AuditLog, UnifiedWorkItem, CommandLog`
  - Identity/Org (shared platform): `Membership, PersonProfile, OrgUnit, Position, Group,
    RoleBinding, PermissionPolicy, DataScope, AssignmentResolution`
  - Control Plane: `ApplicationDefinition, TenantApplicationInstance, AppAccountBinding,
    AppRoleMapping, ProvisioningCommand, ProvisioningConflict`
  - MDM: `MasterRecord, SourceRecord, TenantMasterOverlay, ImportJob, DuplicatePair`
  - Backup: `BackupJob, RestoreJob`
  - Records: `RecordDocument, DocumentVersion`
  - Webhook: `WebhookEvent, OutboxEvent`
- Quy ước: mọi bảng tenant-owned mang `tenantId` và scope `(tenantId, ...)`. Bảng shared
  (identity/geography/master) **không** tenant-scoped → không nằm trong RLS set.

### 7.3 RLS (Row-Level Security)

`PrismaService` cung cấp ba lối vào:

- `db` — client scoped hiện hành (trong context) hoặc base client (ngoài context → RLS
  trả 0 row, fail-safe).
- `withTenant(tenantId, fn)` — mở một **interactive transaction**, chạy
  `SELECT set_config('app.current_tenant', $1, true)` rồi chạy `fn` với client lưu trong
  `AsyncLocalStorage`. Vì `@prisma/adapter-pg` dùng pool, `SET LOCAL` trong transaction là
  cách duy nhất pin GUC vào đúng connection của request. **Re-entrant** (đã có context thì
  chạy thẳng, không lồng transaction).
- `withBypass(fn)` — `SET LOCAL app.bypass_rls='on'` cho việc platform/seed/scheduler hợp
  lệ xuyên tenant.

**35 bảng** (list `TENANT_TABLES` trong `scripts/rls-setup.mjs`) ENABLE + **FORCE** RLS
(FORCE để cả owner `xhub` cũng chịu policy). Mỗi bảng có một policy `tenant_isolation`
với `USING` + `WITH CHECK` cùng predicate null-safe:

```sql
current_setting('app.bypass_rls', true) = 'on'
OR "tenantId" = current_setting('app.current_tenant', true)
```

Không RLS (cố ý): `ApplicationDefinition`, `MasterRecord` (catalog shared), `Tenant`,
`WorkflowVersion`, `WorkflowNode`, `WorkflowEdge` (không có cột `tenantId`, bảo vệ gián
tiếp qua `Workflow` cha). **Khi thêm bảng tenant-owned mới, phải cập nhật thủ công
`TENANT_TABLES` trong `rls-setup.mjs` (và `rls-test.mjs`)** rồi chạy `npm run rls:setup`
+ `npm run test:rls` (MUST_NOT_LEAK: 0 rò rỉ). Code vẫn giữ filter `tenantId` thủ công làm
lớp backup.

### 7.4 Idempotency & transactional outbox

- **CommandEnvelope + idempotency:** `CommandLog` với `@@unique(tenantId, idempotencyKey)`
  cho `/requests` và `/tasks/:id/act` — cùng key → một instance, replay trả cùng kết quả.
- **Control Plane outbox** (`src/controlplane`, `@Controller('api/controlplane')`):
  `ProvisioningCommand` idempotent + conflict center + retry + reconcile (mock adapter,
  `SourceReference` thật). Routes: `GET/POST tenant-applications`, `POST
  app-account-bindings`, `GET provisioning-commands`, `POST provisioning-commands/:id/retry`,
  `GET provisioning-conflicts`.
- **Webhook** (`src/webhook`, `@Controller('api/webhooks')`): inbound HMAC-SHA256 verify
  trên **rawBody** (`hmac.util.ts`, `WEBHOOK_SIGNING_SECRET`, verify constant-time
  `timingSafeEqual`, header `x-webhook-signature`) → dedupe idempotent (`WebhookEvent`
  `@@unique(tenantId, source, externalId)`) → `OutboxEvent` + dispatcher
  `webhook.dispatcher.ts` (`@Interval(15_000)`, backoff mũ `2^attempt` giây, `maxAttempts`
  mặc định 5). Routes:
  `POST /:source` (intake), `POST /reconcile`, `POST /dispatch`, `GET /events`,
  `GET /outbox`. Chỉ lưu boolean `WebhookEvent.signatureValid`, không lưu secret.

### 7.5 Condition AST

`src/xoffice/condition-ast.ts` — evaluator **thuần, không `eval`**, dùng cho branch
selection trong engine:

```ts
export type ConditionAst = string | number | boolean | null | VarRef | ExprNode;
export interface VarRef  { var: string }                       // {var} dot-path
export interface ExprNode { operator: string; operands: ConditionAst[] }
export function evaluateCondition(ast: ConditionAst, context: ConditionContext): boolean;
```

- Operator hỗ trợ: `and/or/not`, `eq/ne/gt/gte/lt/lte`, `in/notIn`, `contains`, `exists`.
- `{var}` resolve theo dot-path null-safe (`resolveVar("form.amount", ctx)`).
- Operator lạ / node hỏng → `false` (fail-safe, không throw → branch config sai không làm
  crash run).

Ví dụ:

```json
{ "operator": "and", "operands": [
  { "operator": "gt", "operands": [ { "var": "form.amount" }, 10000000 ] },
  { "operator": "in", "operands": [ { "var": "form.dept" }, ["FIN", "OPS"] ] }
]}
```

### 7.6 Records / Backup storage

- **Records:** `RecordDocument` + `DocumentVersion` **immutable / append-only** (`versionNo`
  tăng dần, không sửa version cũ; `currentVersionId` tiến lên); dedup theo `contentHash`
  (trùng → tái dùng `storageKey`, `deduped=true`). Object storage **folder-per-tenant**,
  key `storage/documents/<tenantId>/<documentId>/<versionNo>`, base dir override qua
  `DOCUMENTS_STORAGE_DIR` (interface hình S3 `put/get/exists` — S3-ready). Guard secret khi
  ghi.
- **Backup** (`src/backup`): export **RLS-scoped** → manifest (row counts + sha256 checksum
  + outbox watermark), **mã hoá AES-256-GCM** (`BACKUP_ENCRYPTION_KEY`), lưu
  `storage/backups/<tenantId>/`. **MUST_NOT_LEAK** (deny-list shared/global + guard regex
  secret). Restore sandbox / dry-run: verify checksum/schema + remap toàn bộ
  PK/FK/polymorphic/tenantId + giữ outbox in-flight; từ chối ghi đè tenant nguồn.

---

## 8. Auth & authz

### 8.1 Identity (WHO) — luôn chạy, soft

- Session: cookie `xhub_session` (JWT, ký bằng `AUTH_JWT_SECRET`). Module `src/auth/`
  (`POST /api/auth/login|logout`, `GET /me`, `switch-tenant`).
- `IdentityGuard` (`src/auth/identity.guard.ts`) là **global SOFT guard** — không bao giờ
  chặn; resolve identity theo thứ tự **session JWT → header fallback → default demo** và
  gắn vào `req.identity` (controller đọc qua `@Identity()`). `Membership` map user↔tenant.
- Backward-compat: header `x-user-id` / `x-tenant-id` vẫn chạy (bật/tắt qua
  `AUTH_ALLOW_HEADER_IDENTITY`).

### 8.2 Authorization (WHAT) — env-gated

- Đánh dấu route: `@RequirePermission('perm.code')`
  (`src/auth/require-permission.decorator.ts`).
- `PermissionGuard` (`src/auth/permission.guard.ts`) chạy **sau** IdentityGuard, chỉ tác
  động lên route có tag:
  1. **Authentication:** identity `anonymous` (không session + header identity tắt) →
     **401**, độc lập với enforcement.
  2. **Authorization:** khi enforcing (`AUTH_ENFORCE=true` hoặc header test
     `x-authz-enforce`) → hỏi `IdentityService.can(userId, permCode)` (RBAC/ABAC engine,
     chạy trong `withBypass` vì identity là shared plane); thiếu quyền → **403**. Khi
     **không** enforcing (demo mặc định) → **NO-OP** (debug log) — demo + mọi smoke không
     đổi.
- Permission codes ví dụ (dùng cả ở nav gate FE): `home.view, work.view, space.access,
  office.view, customer.view, admin.access, admin.users, admin.org, admin.roles,
  admin.scope, admin.delegation, admin.backup, admin.audit`. Write endpoints
  provisioning/backup/records/identity được gate.

### 8.3 OIDC seam

`src/auth/oidc/` — `oidc.provider.ts` interface + `mock-oidc.provider.ts` (dev
passwordless). Cấu hình qua `AUTH_OIDC_ENABLED / AUTH_OIDC_ISSUER / AUTH_OIDC_CLIENT_ID /
AUTH_OIDC_CLIENT_SECRET / AUTH_OIDC_REDIRECT_URI`. IdP thật (Azure AD) mới có seam, chưa
nối mạng.

### 8.4 Cấu hình production

```env
AUTH_ENFORCE=true
AUTH_ALLOW_HEADER_IDENTITY=false
```

> Xem thêm `xhub-api/SECURITY.md` (§ Authentication & Authorization; secrets policy;
> quy trình rotate `ANTHROPIC_API_KEY`).

---

## 9. Kiểm thử & gate

Backend script (chạy trong `xhub-api`, cần Postgres + `.env`):

| Script | Chứng minh điều gì |
|---|---|
| `npm run test:rls` | RLS per-tenant hoạt động; MUST_NOT_LEAK 0 rò rỉ giữa tenant |
| `npm run test:smoke` | E2E golden path X.Office (13 workflow) — request → task → act → audit |
| `npm run test:isolation` | Tenant lạ truy cập → 404 (isolation) |
| `npm run test:xoffice` | Logic X.Office (definition/version/validate/simulate) |
| `npm run test:controlplane` | Provisioning outbox idempotent + retry + reconcile (reset+smoke) |
| `npm run test:mdm` | Pipeline MDM staging→match→dedup→commit; không auto-merge fuzzy |
| `npm run test:backup` | Export/manifest/checksum/encrypt + restore dry-run remap (30 assertions) |
| `npm run test:records` | RecordDocument/DocumentVersion immutable + dedup contentHash |
| `npm run test:webhook` | Inbound HMAC verify + dedupe + outbox dispatch/reconcile |
| `npm run test:condition` | Condition AST evaluator (operators, dot-path, fail-safe) |
| `npm run test:authz` | RBAC/ABAC: allow/deny/401/oidc |
| `npm run test:manage-slice` | Management OS MG-01 reference slice (objective→metric→review→decision→action) |
| `npm run test:manage-portfolio` | MG-04: stage-gate FSM, link-project (404 nếu id giả), benefit realization suy từ MetricObservation thật |
| `npm run test:people-leave` | PE-01: FSM+overlap+idempotency+SOR_NOT_XOFFICE guard+approve→balance+cancel-refund+ABAC scope+cross-tenant |
| `npm run test:ioc-twin` / `test:ioc-insights` | IOC Digital Twin: RLS/isolation, chiếu dữ liệu Work thật, AI brief draft-first |
| `npm run scan:secrets` | Fail nếu có secret ngoài `.env*` (source-only scan) |

Các script `test:controlplane/mdm/backup/records/webhook` là **reset + smoke** — re-runnable
(reset dữ liệu module rồi chạy smoke).

**Nghi thức gate (sau restart sạch):**

1. Dừng hết dev server cũ (chỉ giữ **một** server trên `:4000` —
   `node dist/src/main.js`).
2. `tsc --noEmit` = **0 lỗi** (FE: 0 lỗi trong `src/**`, bỏ qua `.next/types` generated).
3. `npm run build` (FE) exit 0.
4. Chạy toàn bộ `test:*` ở trên + `scan:secrets` → **tất cả PASS**.

---

## 10. Quy ước & cạm bẫy

- **Next 16 KHÁC bản bạn biết.** `AGENTS.md` / `CLAUDE.md` cảnh báo: đọc guide liên quan
  trong `node_modules/next/dist/docs/` **trước khi** viết code (API/convention/file
  structure có breaking change; chú ý deprecation notice).
- **`DATABASE_URL` percent-encode** mật khẩu (ký tự đặc biệt như `@`, `:`, `/` phải
  encode).
- **Một server / một cổng.** Agent hay spawn trùng dev server → giữ đúng một server
  `:4000`. `start:prod` trỏ sai `dist/main` → luôn `node dist/src/main.js`.
- **FE không chạm DB** — mọi read qua `*.server.ts`, mọi write qua route handler
  `forwardPost`. Không import Prisma/DB vào FE.
- **Không bịa object ERP giả.** Chưa nối thật thì tạo `ExternalExecution` MANUAL_TASK +
  nhập mã tham chiếu thật (SourceReference), không sinh id giả.
- **MUST_NOT_LEAK / không secret trong DB.** Backup deny-list shared/global; secret chỉ
  sống trong `.env*`; guard regex chặn secret trong manifest/metadata.
- **Additive / backward-compatible.** Thay đổi phải giữ demo + smoke chạy (vd list endpoint
  thêm `?page&pageSize` nhưng không có `page` vẫn trả mảng cũ; authz mặc định off).
- **Immutable published version** — không sửa version đã publish; tạo version mới.
- **Nav: chỉ item có route thật** mới vào `XHUB_NAVIGATION` (tránh link chết).
- 🔴 **Key đã lộ:** `ANTHROPIC_API_KEY` (fingerprint `d9d24a2d90654ea4`) cần **người**
  rotate tại console.anthropic.com — không tự động được. Xem `SECURITY.md`.

---

## 10.5 Hỗ trợ khách hàng sản phẩm (Product Customer Support) — 06/08/2026

Module xử lý **ý kiến/hỗ trợ khách hàng cho các sản phẩm ngoài (X2, X1, FinERP, X.Space)** —
thao tác, sửa dữ liệu, hướng dẫn sử dụng, báo lỗi, đề xuất nâng cấp — do đội nội bộ tiếp nhận
(hiện tại từ nhóm Zalo hỗ trợ khách hàng) và ghi nhận chuẩn trên X.Office.

**Vì sao là module MỚI, không dùng lại Service Desk (`office.service-desk`):** Service Desk
(`src/tickets/*`) là helpdesk **nội bộ** — nhân viên tự yêu cầu, nhân viên khác xử lý (không có
khái niệm khách hàng ngoài, sản phẩm, hay lỗi phần mềm). Product Customer Support (`src/support-
cases/*`, model `SupportCase`/`SupportCaseEvent`, `prisma-xoffice/schema.prisma`) là khác đối
tượng hoàn toàn: khách hàng bên ngoài, gắn với 1 sản phẩm (`productCode`, plain string tham
chiếu `Product.code` ở Platform DB — không FK, đúng quy ước cross-DB đã dùng cho
`tenantLaunchId`), có thể gắn với 1 `Customer` (CRM nội bộ, cùng DB, FK thật).

**FSM** (`src/support-cases/support-cases.fsm.ts`): `NEW → TRIAGED → IN_PROGRESS ⇄
WAITING_CUSTOMER → RESOLVED → CLOSED`, `CANCELLED` từ mọi trạng thái đang mở.

**Action "Chuyển Backlog/Defect" — điểm mấu chốt của module:** một case cần nâng cấp phần mềm
có nút chuyển thành `BacklogItem` (tính năng/nâng cấp) hoặc `Defect` (lỗi) trên **Engineering
Governance Hub** (Platform DB, `:4000`). Đây là lời gọi HTTP THẬT qua process khác
(`EngineeringSupportClient`, cùng khuôn với `LaunchFactoryClient` của Delivery→Launch) — không
có bảng chung, không bypass. Ghi lại 2 chiều: `BacklogItem/Defect.sourceRef` = mã case,
`.correlationId` = id case; `SupportCase.escalatedItemId/escalatedItemCode` = id/mã mục đã tạo.
Idempotent: bấm lại không tạo mục thứ 2, trả về mục đã có (`replayed: true`).

**⚠️ Không có entity "ChangeRequest" riêng.** `docs/implementation/engineering-hub/
ADR_GOVERNANCE_RECONCILIATION.md` đã quyết định KHÔNG xây `ChangeRequest` như 1 entity riêng —
action "chuyển change request" ở đây map vào `BacklogItem` (type `FEATURE`/`UPGRADE_MIGRATION`/
`TECH_DEBT`/`TASK`) hoặc `Defect`, tái dùng đúng 2 entity đã có sẵn trong Engineering Hub, không
xây thêm entity mới ngoài phạm vi đã chốt trước đó.

**File chính:** backend `xhub-api/src/support-cases/{support-cases.fsm,.service,.controller,
.module,engineering-support.client}.ts`; seed `scripts/support-cases-seed.mjs` (3 case mẫu theo
đúng dạng hội thoại hỗ trợ X2 thật — đổi hotline, đối soát thu/chi, hướng dẫn sử dụng — không
copy nguyên văn); smoke `scripts/support-cases-smoke.mjs` (`npm run test:support-cases`, cần cả
2 process :4000+:4001). Frontend: `xhub-web/src/app/(app)/office/support-cases/{page,[id]/page}
.tsx`, `xhub-web/src/xoffice/support-cases/{SupportCaseActions,SupportCaseCreateButton}.client
.tsx`, lib `xhub-web/src/xoffice/lib/support-cases-data.ts`. Nav: nhóm mới `office.support`
(cạnh `office.services`/`office.sales`).

**Quyền:** role mới `PRODUCT_SUPPORT_AGENT` (`support-case.create/manage/resolve` +
`engineering.backlog.manage` — cần quyền này để escalate-to-Backlog thành công qua guard thật
của Platform, không bypass). Seed cả 2 DB (`npm run seed:roles` + `seed:roles-xoffice`) vì
`role-registry.seed.json` là 1 nguồn, nhân ra cả Platform và X.Office.

## 11. Tài liệu liên quan

- **`D:\Code\PROJECT_STATUS_XHUB.md`** — báo cáo tình trạng / handoff tổng (kiến trúc,
  roadmap nền tảng 8/8, verify gate, backlog).
- **`D:\Code\xhub-api\SECURITY.md`** — secrets policy, bảng env, quy trình rotate, hardening
  auth/authz.
- Gap-analysis / implementation-plan (gốc `xhub-web`): `PILOT_PROCEDURES_GAP_ANALYSIS.md`,
  `SOR_GAP_ANALYSIS.md`, `XOFFICE_STANDALONE_GAP_ANALYSIS.md`,
  `TENANT_BACKUP_RESTORE_GAP_ANALYSIS.md`, `INTEGRATION_READINESS_GAP_ANALYSIS.md`,
  `IDENTITY_ORG_GAP_ANALYSIS.md`, `TENANT_BACKUP_GAP_ANALYSIS.md`,
  `IMPLEMENTATION_PLAN_XOFFICE_STANDALONE.md`, `IMPLEMENTATION_PLAN_IDENTITY_ORG_BACKUP.md`.
  (Gốc `xhub-api` cũng có bộ tương ứng: `CONTROL_PLANE_MDM_GAP_ANALYSIS.md`,
  `TENANT_ADMIN_UI_GAP_ANALYSIS.md`, `IMPLEMENTATION_PLAN_*`.)
- ADR / contracts: `D:\Code\xhub\docs\architecture` (ADR-012 FE+BFF, ADR-014/015,
  adr-sor-001/002/003) + `xhub-api/src/xoffice/contracts/source-reference.ts`.

---

_Guide này mô tả trạng thái POC/demo chạy trên hạ tầng thật. Khi nối connector thật
(FinERP/Frappe HR/Mattermost), IdP Azure AD, và bật `AUTH_ENFORCE=true`, cập nhật lại các
mục §7–§8 tương ứng._
