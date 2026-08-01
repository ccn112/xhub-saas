import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { channelBySlug } from "@/xhub/lib/repo";

/**
 * Gọn: header channel dựng ngay trong page (ChannelShell.tsx chưa tồn tại).
 * Nếu sau này có ChannelShell dùng chung thì thay thế import ở các page.
 */
export function ChannelHeader({
  slug,
  active,
  breadcrumb,
}: {
  slug: string;
  active?: "chat" | "page" | "lists" | "huddles" | "workflows";
  breadcrumb?: string;
}) {
  const channel = channelBySlug(slug);
  const base = `/space/channels/${slug}`;
  const tabs: { key: string; label: string; href: string }[] = [
    { key: "chat", label: "Trò chuyện", href: base },
    { key: "page", label: "Trang channel", href: `${base}/page` },
    { key: "lists", label: "Danh sách", href: `${base}/lists/list-week32` },
    { key: "huddles", label: "Họp nhanh", href: `${base}/huddles/huddle-demo-mp` },
    { key: "workflows", label: "Workflow", href: `${base}/workflows/workflow-customer-demo` },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400 dark:text-dark-300">
        <Link href="/space" className="hover:text-primary-600">X.Space</Link>
        <span>/</span>
        <span className="text-gray-500 dark:text-dark-200">{channel?.name ?? slug}</span>
        {breadcrumb ? (
          <>
            <span>/</span>
            <span className="text-gray-600 dark:text-dark-100">{breadcrumb}</span>
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-lg bg-primary-600/10 text-xl text-primary-600"># </span>
          <div>
            <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">{channel?.name ?? slug}</h1>
            <p className="max-w-xl text-sm text-gray-500 dark:text-dark-300">{channel?.purpose}</p>
          </div>
        </div>
        <Badge tone={channel?.type === "private" ? "neutral" : "info"}>{channel?.type === "private" ? "Riêng tư" : "Công khai"}</Badge>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-dark-600">
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <Link
              key={t.key}
              href={t.href}
              className={
                isActive
                  ? "border-b-2 border-primary-600 px-3 py-2 text-sm font-medium text-primary-600"
                  : "border-b-2 border-transparent px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-dark-300 dark:hover:text-dark-100"
              }
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

const fileIcon: Record<string, string> = { pdf: "📕", pptx: "📙", xlsx: "📗", docx: "📘" };

export function docIcon(type?: string): string {
  return fileIcon[type ?? ""] ?? "📄";
}

export function fileSize(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}
