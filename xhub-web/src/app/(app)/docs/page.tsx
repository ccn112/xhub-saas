import Link from "next/link";
import { Card } from "@/xhub/ui/Card";

const SECTIONS = [
  {
    href: "/docs/business",
    icon: "💼",
    title: "Nghiệp vụ",
    desc: "Tổng quan XHub, 16 vai trò & phân quyền 3 tầng, các luồng Request/Directive/Ticket, quy tắc bất biến.",
    source: "BUSINESS_REQUIREMENTS.md",
  },
  {
    href: "/docs/saas",
    icon: "🏢",
    title: "SaaS (Tenant 001–010)",
    desc: "Định vị & di trú, nền tảng khởi tạo tenant (registry, launch factory, blueprint/seed), triển khai T002–T011.",
    source: "saas/",
  },
  {
    href: "/docs/developer",
    icon: "🛠️",
    title: "Phát triển",
    desc: "Kiến trúc, chạy dự án local, design system Tailux, điều hướng, thêm màn hình mới.",
    source: "DEVELOPER_GUIDE.md",
  },
  {
    href: "/docs/design-system",
    icon: "🎨",
    title: "Hệ thống thiết kế",
    desc: "Bộ chữ/màu/component đang dùng (chốt 05/08/2026) + mô phỏng sống 6 dạng trang Tailux (dashboard, danh sách, chi tiết, popup form, wizard, form đơn giản).",
    source: "design-system/TAILUX_PAGE_PATTERNS.md",
  },
  {
    href: "/docs/backlog",
    icon: "🗂️",
    title: "Backlog",
    desc: "Nhật ký phát triển: sơ đồ version milestone, đã hoàn thành, đang làm, known issues.",
    source: "DEV_BACKLOG.md",
  },
  {
    href: "/docs/user",
    icon: "📖",
    title: "Hướng dẫn sử dụng",
    desc: "Đăng nhập, điều hướng 5 workspace, trang chủ, công việc, tài liệu, quản trị doanh nghiệp.",
    source: "USER_GUIDE.md",
  },
  {
    href: "/docs/test",
    icon: "✅",
    title: "Kiểm thử",
    desc: "Bảng kết quả bot-test 12 cổng tự động + danh sách kiểm thử tay U1–U15 bạn tự tick.",
    source: "TEST_LOG.md",
  },
];

export default function DocsHomePage() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {SECTIONS.map((s) => (
        <Link key={s.href} href={s.href} className="group block">
          <Card className="flex h-full flex-col p-5 transition-shadow group-hover:shadow-soft-lg">
            <span className="flex size-11 items-center justify-center rounded-lg bg-primary-600/10 text-2xl">{s.icon}</span>
            <h2 className="font-heading mt-4 text-lg font-semibold text-gray-800 group-hover:text-primary-600 dark:text-dark-50">
              {s.title}
            </h2>
            <p className="mt-1.5 flex-1 text-sm leading-6 text-gray-500 dark:text-dark-300">{s.desc}</p>
            <p className="mt-4 font-mono text-xs text-gray-400 dark:text-dark-400">docs/{s.source}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
