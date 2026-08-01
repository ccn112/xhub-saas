// Two-tier navigation (Tailux style): icon rail = segments, prime panel = items.
export interface NavItem { label: string; href: string }
export interface NavSegment {
  key: string;
  label: string;
  icon: string; // heroicon name key (mapped in IconRail)
  items: NavItem[];
}

export const SEGMENTS: NavSegment[] = [
  {
    key: "home",
    label: "Trang chủ",
    icon: "home",
    items: [
      { label: "Tổng quan điều hành", href: "/home/executive" },
      { label: "Bảng điều hành kinh doanh", href: "/home/sales" },
      { label: "Không gian của tôi", href: "/home/me" },
    ],
  },
  {
    key: "inbox",
    label: "Hộp việc & phê duyệt",
    icon: "inbox",
    items: [
      { label: "Hộp việc hợp nhất", href: "/inbox" },
      { label: "Trung tâm phê duyệt", href: "/approvals" },
    ],
  },
  {
    key: "work",
    label: "Công việc & dự án",
    icon: "check",
    items: [
      { label: "Công việc & chỉ đạo", href: "/work" },
      { label: "Tổng quan dự án", href: "/projects/project-finerp-minhphat" },
    ],
  },
  {
    key: "space",
    label: "X.Space — Trao đổi",
    icon: "chat",
    items: [
      { label: "Trang chủ X.Space", href: "/space/home" },
      { label: "Channel triển khai (hội thoại)", href: "/space/channels/trien-khai-finerp-minh-phat" },
      { label: "Channel dự án (tổng quan)", href: "/space/channels/trien-khai-finerp-minh-phat/overview" },
      { label: "Channel khách hàng (360)", href: "/space/channels/kh-minh-phat/customer" },
      { label: "Tin nhắn trực tiếp", href: "/space/dm/user-thuha" },
    ],
  },
  {
    key: "apps",
    label: "Ứng dụng",
    icon: "apps",
    items: [
      { label: "Danh mục ứng dụng", href: "/apps" },
    ],
  },
  {
    key: "ai",
    label: "X.AI",
    icon: "ai",
    items: [
      { label: "Trợ lý X.AI (sắp có)", href: "/home/executive" },
    ],
  },
];

/** Which segment owns a given pathname (for initial active state). */
export function segmentForPath(pathname: string): string {
  const hit = SEGMENTS.find((s) => s.items.some((i) => pathname.startsWith(i.href.split("?")[0])));
  if (hit) return hit.key;
  if (pathname.startsWith("/space")) return "space";
  if (pathname.startsWith("/apps")) return "apps";
  return "home";
}
