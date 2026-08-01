# Quy ước dựng màn XHub / X.Space (Next.js 16 + Tailux/Tailwind)

Base: Next.js 16 App Router + Tailwind v4 (design system Tailux đã port). Dev: http://localhost:3001, log /tmp/webdev.log.

## Vị trí file
- Màn đặt trong route group `src/app/(app)/...` để dùng shell chung (Sidebar + Topbar).
- Route map: `src/xhub/config/screen-manifest.json`. Spec màn: `src/data/screens/<CODE>.screen.json`.
- Seed (nguồn sự thật): `src/data/seed/*.json`. Ảnh tham chiếu: `public/reference-images/`.

## Nguyên tắc
- Server component đọc seed qua repo layer; KHÔNG hardcode dữ liệu; KHÔNG `Date.now()`/random (dùng `NOW` từ format.ts nếu cần "hiện tại").
- Mọi truy vấn scoped tenant qua `collection/byId/where` (tự lọc tenant + guard MUST_NOT_LEAK).
- UI tiếng Việt; giữ tên thương hiệu/thuật ngữ. Hỗ trợ dark mode (dùng class `dark:` như kit).
- AI chỉ tóm tắt/gợi ý — KHÔNG tự phê duyệt tài chính/ký số/đổi quyền/submit ERP.
- Đủ trạng thái: loading (skeleton), empty (giải thích + CTA), error, permission (ẩn action / 403).
- Tương tác thật (nút bấm có handler, input) → tách component `"use client"`. Server component chỉ render tĩnh + Link.

## API repo (import)
```ts
import { collection, byId, where, indexById, CANONICAL_TENANT_ID, SEED_META } from "@/xhub/lib/seed";
import { vnd, vndShort, num, dateVN, timeVN, dateTimeVN, NOW } from "@/xhub/lib/format";
import { userName, user, usersIndex, orgName, channelBySlug, initials } from "@/xhub/lib/repo";
import { getWorkspaceContext } from "@/xhub/lib/workspace";
import type { ... } from "@/xhub/lib/screen-types";
```

## UI kit (Tailwind, đã có)
- `@/xhub/ui/Card` → `Card`, `SectionCard` (title, action, bodyClassName).
- `@/xhub/ui/StatCard` → `StatCard` (label, value, sub, icon emoji, tone).
- `@/xhub/ui/Badge` → `Badge` (tone: primary|success|warning|error|info|neutral).
- `@/xhub/ui/AiRecap` → `AiRecap` (points, footnote).
- `@/xhub/ui/charts/AreaChart`, `@/xhub/ui/charts/DonutChart` (client). Cần chart khác: tạo client component `"use client"` + `dynamic(() => import("react-apexcharts"), { ssr:false })`.
- Style bằng Tailwind utilities + token Tailux: `bg-white dark:bg-dark-700`, `text-gray-*`/`dark:text-dark-*`, `primary-600`, `success/warning/error/info`, `rounded-lg`, `shadow-soft`, `font-heading`.

## Khung trang
```tsx
export const metadata = { title: "<Tên> · XHub" };
export default function Screen() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Tên màn</h1>
        <p className="text-sm text-gray-500 dark:text-dark-300">Mô tả ngắn</p>
      </div>
      {/* sections theo screen.json */}
    </div>
  );
}
```
Màn mẫu: `src/app/(app)/hub/home/executive/page.tsx` (XH-01).

## Params động (Next 16): `params` là Promise → `const { slug } = await params;`

## Verify
`curl -s -o /dev/null -w "%{http_code}" http://localhost:3001<route>` phải 200; log /tmp/webdev.log không có "Module not found"/"Error"/"failed to compile".
