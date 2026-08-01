"use client";

// Topbar notification bell — client-side fetch of unread-count + recent list,
// popover panel, per-item mark-read + deep-link navigation, mark-all.
import { useCallback, useEffect, useState } from "react";
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react";
import {
  BellIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  BellAlertIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { dateTimeVN } from "@/xhub/lib/format";
import {
  NOTIF_API_CLIENT,
  fetchNotifications,
  fetchUnreadCount,
  iconKeyForType,
  markAllNotificationsRead,
  markNotificationRead,
  type XNotification,
} from "@/xhub/lib/notifications";

// ----------------------------------------------------------------------

const TYPE_ICON: Record<string, React.ElementType> = {
  approval: ClipboardDocumentCheckIcon,
  task: CheckCircleIcon,
  chat: ChatBubbleLeftRightIcon,
  alert: ExclamationTriangleIcon,
  doc: DocumentTextIcon,
  bell: BellAlertIcon,
};

const RECENT_LIMIT = 8;

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<XNotification[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [list, unread] = await Promise.all([
      fetchNotifications(NOTIF_API_CLIENT),
      fetchUnreadCount(NOTIF_API_CLIENT),
    ]);
    // Sort newest first; keep only the most recent for the panel.
    const sorted = [...list].sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
    );
    setItems(sorted.slice(0, RECENT_LIMIT));
    // Trust the dedicated endpoint; fall back to derived unread if it is 0.
    const derived = sorted.filter((n) => !n.readAt).length;
    setCount(unread || derived);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    // Light polling so the badge stays roughly current.
    const t = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  const handleOpenItem = useCallback(
    async (n: XNotification, close: () => void) => {
      if (!n.readAt) {
        await markNotificationRead(NOTIF_API_CLIENT, n.id);
      }
      close();
      await refresh();
      if (n.deepLink) router.push(n.deepLink);
    },
    [refresh, router],
  );

  const handleReadAll = useCallback(async () => {
    await markAllNotificationsRead(NOTIF_API_CLIENT);
    await refresh();
  }, [refresh]);

  const badge = count > 99 ? "99+" : String(count);

  return (
    <Popover className="relative">
      <PopoverButton
        as="button"
        aria-label="Thông báo"
        className="dark:text-dark-200 dark:hover:bg-dark-600 relative flex size-9 cursor-pointer items-center justify-center rounded-full text-gray-500 outline-hidden hover:bg-gray-100"
      >
        <BellIcon className="size-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white ring-2 ring-white dark:ring-dark-900">
            {badge}
          </span>
        )}
      </PopoverButton>
      <Transition
        enter="duration-200 ease-out"
        enterFrom="translate-x-2 opacity-0"
        enterTo="translate-x-0 opacity-100"
        leave="duration-200 ease-out"
        leaveFrom="translate-x-0 opacity-100"
        leaveTo="translate-x-2 opacity-0"
      >
        <PopoverPanel
          anchor={{ to: "bottom end", gap: 12 }}
          className="border-gray-150 shadow-soft dark:border-dark-600 dark:bg-dark-700 z-70 flex w-80 flex-col rounded-lg border bg-white transition dark:shadow-none"
        >
          {({ close }) => (
            <>
              <div className="flex items-center justify-between border-b border-gray-150 px-4 py-3 dark:border-dark-600">
                <h3 className="dark:text-dark-100 font-heading text-sm font-semibold text-gray-800">
                  Thông báo
                </h3>
                {count > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleReadAll()}
                    className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
                  >
                    Đánh dấu tất cả đã đọc
                  </button>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <p className="dark:text-dark-300 px-4 py-8 text-center text-sm text-gray-400">
                    Đang tải…
                  </p>
                ) : items.length === 0 ? (
                  <p className="dark:text-dark-300 px-4 py-8 text-center text-sm text-gray-400">
                    Không có thông báo
                  </p>
                ) : (
                  items.map((n) => {
                    const Icon = TYPE_ICON[iconKeyForType(n.type)] ?? BellIcon;
                    const unread = !n.readAt;
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => void handleOpenItem(n, close)}
                        className={
                          "group flex w-full items-start gap-3 px-4 py-3 text-start outline-hidden transition-colors hover:bg-gray-100 dark:hover:bg-dark-600 " +
                          (unread ? "bg-primary-50/40 dark:bg-dark-600/40" : "")
                        }
                      >
                        <div className="dark:bg-dark-600 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:text-dark-200">
                          <Icon className="size-4.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2">
                            <p className="dark:text-dark-100 line-clamp-1 flex-1 text-sm font-medium text-gray-800">
                              {n.title}
                            </p>
                            {unread && (
                              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary-500" />
                            )}
                          </div>
                          {n.body && (
                            <p className="dark:text-dark-300 mt-0.5 line-clamp-2 text-xs text-gray-500">
                              {n.body}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-gray-400">
                            {dateTimeVN(n.createdAt)}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="border-t border-gray-150 px-4 py-2.5 text-center dark:border-dark-600">
                <Link
                  href="/notifications"
                  onClick={() => close()}
                  className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
                >
                  Xem tất cả
                </Link>
              </div>
            </>
          )}
        </PopoverPanel>
      </Transition>
    </Popover>
  );
}
