import { ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { collection } from "@/xhub/lib/seed";
import type { Channel } from "@/xhub/lib/types";

export type ChannelTab =
  | "conversation"
  | "overview"
  | "customer"
  | "lists"
  | "workflows"
  | "huddles"
  | "threads";

interface Section {
  key: string;
  label: string;
}

const SECTIONS: Section[] = [
  { key: "my_channels", label: "Kênh của bạn" },
  { key: "projects", label: "Dự án" },
  { key: "customers", label: "Khách hàng" },
];

function channelGlyph(c: Channel): string {
  if (c.type === "private") return "🔒";
  return "#";
}

/**
 * Shared X.Space channel shell: left channel rail + channel header/tabs, then a
 * content slot. Server component; interactions live in child "use client" parts.
 */
export function ChannelShell({
  channel,
  active,
  memberCount,
  children,
}: {
  channel: Channel;
  active: ChannelTab;
  memberCount: number;
  children: ReactNode;
}) {
  const channels = collection<Channel>("channels");
  const base = `/space/channels/${channel.slug}`;

  const tabs: { key: ChannelTab; label: string; href: string; show: boolean }[] = [
    { key: "conversation", label: "Hội thoại", href: base, show: true },
    { key: "overview", label: "Tổng quan", href: `${base}/overview`, show: !!channel.projectId },
    { key: "customer", label: "Khách hàng", href: `${base}/customer`, show: !!channel.customerId },
    { key: "lists", label: "Danh sách", href: `${base}/lists`, show: true },
    { key: "workflows", label: "Quy trình", href: `${base}/workflows`, show: true },
    { key: "huddles", label: "Huddle", href: `${base}/huddles`, show: true },
    { key: "threads", label: "Thread", href: `${base}/threads`, show: true },
  ];

  return (
    <div className="flex min-h-full gap-0 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-dark-600 dark:bg-dark-700">
      {/* Channel rail */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-gray-200 bg-gray-50 md:flex dark:border-dark-600 dark:bg-dark-750">
        <div className="flex h-14 items-center gap-2 border-b border-gray-200 px-4 dark:border-dark-600">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary-600 text-sm font-bold text-white">X</span>
          <span className="font-heading text-sm font-bold text-gray-800 dark:text-dark-50">X.Space</span>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <Link
            href="/space/home"
            className="mb-2 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-dark-200 dark:hover:bg-dark-600"
          >
            <span className="w-4 text-center">🏠</span> Trang chủ
          </Link>
          {SECTIONS.map((section) => {
            const items = channels.filter((c) => c.section === section.key);
            if (items.length === 0) return null;
            return (
              <div key={section.key} className="mb-3">
                <p className="px-2.5 py-1 text-tiny-plus font-semibold tracking-wider text-gray-400 uppercase dark:text-dark-300">
                  {section.label}
                </p>
                <ul className="space-y-0.5">
                  {items.map((c) => {
                    const on = c.id === channel.id;
                    return (
                      <li key={c.id}>
                        <Link
                          href={`/space/channels/${c.slug}`}
                          aria-current={on ? "page" : undefined}
                          className={clsx(
                            "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                            on
                              ? "bg-primary-600/10 font-semibold text-primary-700 dark:bg-primary-400/15 dark:text-primary-300"
                              : "text-gray-600 hover:bg-gray-100 dark:text-dark-200 dark:hover:bg-dark-600",
                          )}
                        >
                          <span className="w-4 shrink-0 text-center text-gray-400">{channelGlyph(c)}</span>
                          <span className="truncate">{c.name}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Channel body */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="border-b border-gray-200 px-5 pt-4 dark:border-dark-600">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 font-heading text-lg font-bold text-gray-800 dark:text-dark-50">
                <span className="text-gray-400">{channelGlyph(channel)}</span>
                <span className="truncate">{channel.name}</span>
                {channel.type === "private" ? (
                  <span className="rounded bg-gray-150 px-1.5 py-0.5 text-tiny-plus font-medium text-gray-500 dark:bg-dark-500 dark:text-dark-100">
                    Riêng tư
                  </span>
                ) : null}
              </h1>
              {channel.purpose ? (
                <p className="mt-0.5 line-clamp-1 text-sm text-gray-500 dark:text-dark-300">{channel.purpose}</p>
              ) : null}
            </div>
            <div className="hidden shrink-0 items-center gap-2 text-sm text-gray-500 sm:flex dark:text-dark-300">
              <span className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 dark:border-dark-600">
                👥 {memberCount}
              </span>
              <button className="rounded-lg border border-gray-200 px-2.5 py-1 hover:bg-gray-50 dark:border-dark-600 dark:hover:bg-dark-600">
                📞 Huddle
              </button>
            </div>
          </div>
          {/* Tabs */}
          <nav className="-mb-px mt-3 flex gap-1 overflow-x-auto">
            {tabs
              .filter((t) => t.show)
              .map((t) => {
                const on = t.key === active;
                return (
                  <Link
                    key={t.key}
                    href={t.href}
                    aria-current={on ? "page" : undefined}
                    className={clsx(
                      "shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                      on
                        ? "border-primary-600 text-primary-700 dark:text-primary-300"
                        : "border-transparent text-gray-500 hover:text-gray-800 dark:text-dark-300 dark:hover:text-dark-50",
                    )}
                  >
                    {t.label}
                  </Link>
                );
              })}
          </nav>
        </header>

        {/* Content slot */}
        <div className="min-w-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
