// "Ứng dụng thành viên" — các dự án nội bộ đăng ký vào Hub qua deep-link.
// KHÔNG di chuyển code; chỉ khai báo metadata + href để mở tab ngoài.

export type MemberAppLaunchMode = "external";

export interface MemberApp {
  key: string;
  name: string;
  description: string;
  category: string;
  launchMode: MemberAppLaunchMode;
  href: string;
}

export const MEMBER_APPS: MemberApp[] = [
  {
    key: "x1",
    name: "Meyland",
    description: "ERP bất động sản — web ERP (rổ hàng) và app khách hàng.",
    category: "ERP bất động sản",
    launchMode: "external",
    href: "https://x1.local",
  },
  {
    key: "x2",
    name: "X2-BMS",
    description: "SaaS quản lý vận hành chung cư — backend + app cư dân.",
    category: "SaaS vận hành",
    launchMode: "external",
    href: "https://x2.fino.vn",
  },
  {
    key: "xweb",
    name: "X Web Platform",
    description: "Multi-site content — Next.js + Payload CMS.",
    category: "Website / CMS",
    launchMode: "external",
    href: "https://xweb.local",
  },
];
