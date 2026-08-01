"use client";

// Full notification center — groups unread/read, filters by type, marks read,
// deep-links. Seeds from the server fetch; refreshes client-side after writes.
import { useCallback, useMemo, useState } from "react";
import {
  BellIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  BellAlertIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";

import { dateTimeVN } from "@/xhub/lib/format";
import {
  NOTIF_API_CLIENT,
  fetchNotifications,
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

function byNewest(a: XNotification, b: XNotification) {
  return +new Date(b.createdAt) - +new Date(a.createdAt);
}

export function NotificationsClient({
  initialItems,
}: {
  initialItems: XNotification[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<XNotification[]>(
    [...initialItems].sort(byNewest),
  );
  const [filter, setFilter] = useState<string>("all");

  const refresh = useCallback(async () => {
    const list = await fetchNotifications(NOTIF_API_CLIENT);
    setItems([...list].sort(byNewest));
  }, []);

  const openItem = useCallback(
    async (n: XNotification) => {
      if (!n.readAt) await markNotificationRead(NOTIF_API_CLIENT, n.id);
      await refresh();
      if (n.deepLink) router.push(n.deepLink);
    },
    [refresh, router],
  );

  const readAll = useCallback(async () => {
    await markAllNotificationsRead(NOTIF_API_CLIENT);
    await refresh();
  }, [refresh]);

  const types = useMemo(
    () => Array.from(new Set(items.map((n) => n.type))).sort(),
    [items],
  );

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((n) => n.type === filter)),
    [items, filter],
  );

  const unread = filtered.filter((n) => !n.readAt);
  const read = filtered.filter((n) => n.readAt);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label="Tất cả"
          />
          {types.map((t) => (
            <FilterChip
              key={t}
              active={filter === t}
              onClick={() => setFilter(t)}
              label={t}
            />
          ))}
        </div>
        {items.some((n) => !n.readAt) && (
          <button
            type="button"
            onClick={() => void readAll()}
            className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            Đánh dấu tất cả đã đọc
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="dark:border-dark-600 rounded-lg border border-dashed border-gray-200 py-16 text-center">
          <BellIcon className="mx-auto size-10 text-gray-300 dark:text-dark-400" />
          <p className="dark:text-dark-300 mt-2 text-sm text-gray-400">
            Không có thông báo
          </p>
        </div>
      ) : (
        <>
          {unread.length > 0 && (
            <Section title={`Chưa đọc (${unread.length})`}>
              {unread.map((n) => (
                <Item key={n.id} n={n} onOpen={openItem} />
              ))}
            </Section>
          )}
          {read.length > 0 && (
            <Section title={`Đã đọc (${read.length})`}>
              {read.map((n) => (
                <Item key={n.id} n={n} onOpen={openItem} />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
        (active
          ? "border-primary-600 bg-primary-600 text-white"
          : "dark:border-dark-500 dark:text-dark-200 dark:hover:bg-dark-600 border-gray-200 text-gray-600 hover:bg-gray-100")
      }
    >
      {label}
    </button>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="dark:text-dark-300 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </h2>
      <div className="dark:border-dark-600 dark:divide-dark-600 divide-y divide-gray-150 overflow-hidden rounded-lg border border-gray-200">
        {children}
      </div>
    </div>
  );
}

function Item({
  n,
  onOpen,
}: {
  n: XNotification;
  onOpen: (n: XNotification) => void | Promise<void>;
}) {
  const Icon = TYPE_ICON[iconKeyForType(n.type)] ?? BellIcon;
  const unread = !n.readAt;
  return (
    <button
      type="button"
      onClick={() => void onOpen(n)}
      className={
        "dark:bg-dark-700 dark:hover:bg-dark-600 flex w-full items-start gap-3 bg-white px-4 py-3 text-start transition-colors hover:bg-gray-50 " +
        (unread ? "bg-primary-50/40 dark:bg-dark-600/40" : "")
      }
    >
      <div className="dark:bg-dark-600 mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:text-dark-200">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="dark:text-dark-100 flex-1 text-sm font-medium text-gray-800">
            {n.title}
          </p>
          {unread && (
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary-500" />
          )}
        </div>
        {n.body && (
          <p className="dark:text-dark-300 mt-0.5 text-xs text-gray-500">
            {n.body}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {n.sourceSystem && (
            <span className="dark:bg-dark-600 dark:text-dark-200 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
              {n.sourceSystem}
            </span>
          )}
          <span className="text-[11px] text-gray-400">
            {dateTimeVN(n.createdAt)}
          </span>
        </div>
      </div>
    </button>
  );
}
