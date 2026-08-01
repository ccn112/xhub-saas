import type { NavigationItem, NavigationMode } from "./types";

export const PLATFORM_DEFAULT_NAVIGATION_MODE: NavigationMode = "rail-context";

export const PRIMARY_NAVIGATION: NavigationItem[] = [
  { id: "home", label: "Trang chủ", icon: "home", href: "/home", permission: "home.view" },
  { id: "inbox", label: "Hộp việc", icon: "inbox", href: "/inbox", permission: "inbox.view", badgeKey: "inbox.open" },
  { id: "space", label: "X.Space", icon: "messages", href: "/space/home", permission: "space.access", badgeKey: "space.unread" },
  { id: "work", label: "Công việc", icon: "clipboard-check", href: "/work", permission: "work.view" },
  { id: "approvals", label: "Phê duyệt", icon: "approval", href: "/approvals", permission: "approval.view", badgeKey: "approval.pending" },
  { id: "projects", label: "Dự án", icon: "grid", href: "/projects", permission: "project.view" },
  { id: "customers", label: "Khách hàng", icon: "users", href: "/customers", permission: "customer.view" },
  { id: "documents", label: "Tài liệu", icon: "file", href: "/documents", permission: "document.view" },
  { id: "reports", label: "Báo cáo", icon: "chart", href: "/reports", permission: "report.view" },
  { id: "apps", label: "Ứng dụng", icon: "apps", href: "/apps", permission: "app.view" },
  { id: "ai", label: "X.AI", icon: "sparkles", href: "/ai", permission: "ai.use" },
  { id: "admin", label: "Quản trị", icon: "settings", href: "/admin", permission: "admin.access" }
];
