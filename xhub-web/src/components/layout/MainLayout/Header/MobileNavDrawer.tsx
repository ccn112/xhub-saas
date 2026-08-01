"use client";

// Mobile-only navigation drawer (header hamburger). Shows a workspace switcher
// at the top and — like the desktop rail + prime panel — ONLY the selected
// workspace's menu below it (not all workspaces at once). Defaults to the
// active workspace; tapping a workspace tab swaps the menu; tapping a leaf
// navigates and closes.
import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { usePathname } from "next/navigation";
import { Dialog, DialogPanel, Transition, TransitionChild } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";

import { useNavigation } from "@/xhub/nav/NavigationProvider";
import { findActivePrimary, isItemActive } from "@/xhub/nav/resolver";
import { navigationIcons } from "@/navigation/icons";
import type { XNavItem } from "@/xhub/nav/navigation.model";

function Icon({ name, className }: { name?: string; className?: string }) {
  const C = name ? navigationIcons[name] : undefined;
  return C ? <C className={className} /> : null;
}

function Leaf({ item, pathname, onNavigate }: { item: XNavItem; pathname: string; onNavigate: () => void }) {
  const on = isItemActive(item, pathname);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={on ? "page" : undefined}
      className={clsx(
        "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
        on
          ? "bg-primary-600/10 font-medium text-primary-600 dark:text-primary-400"
          : "text-gray-600 hover:bg-gray-100 dark:text-dark-200 dark:hover:bg-dark-600",
      )}
    >
      <Icon name={item.icon} className="size-4 shrink-0 text-gray-400 dark:text-dark-300" />
      {item.label}
    </Link>
  );
}

export function MobileNavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname() ?? "";
  const { tree } = useNavigation();

  const activeWs = findActivePrimary(tree, pathname);
  const [selectedId, setSelectedId] = useState<string | undefined>(activeWs?.id);

  // Follow the active workspace whenever the drawer (re)opens or the route moves.
  useEffect(() => {
    if (open) setSelectedId(activeWs?.id ?? tree[0]?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeWs?.id]);

  const selected = tree.find((w) => w.id === selectedId) ?? activeWs ?? tree[0];

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-[80] md:hidden">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/40" />
        </TransitionChild>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200" enterFrom="-translate-x-full" enterTo="translate-x-0"
          leave="ease-in duration-150" leaveFrom="translate-x-0" leaveTo="-translate-x-full"
        >
          <DialogPanel className="fixed inset-y-0 left-0 flex w-[86%] max-w-xs flex-col bg-white dark:bg-dark-900">
            {/* Brand + close */}
            <div className="flex items-center justify-between border-b border-gray-150 px-4 py-3 dark:border-dark-600">
              <span className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary-600 font-heading text-sm font-bold text-white">X</span>
                <span className="font-heading text-sm font-semibold text-gray-800 dark:text-dark-50">XHub</span>
              </span>
              <button type="button" aria-label="Đóng menu" onClick={onClose} className="flex size-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-dark-200 dark:hover:bg-dark-600">
                <XMarkIcon className="size-5" />
              </button>
            </div>

            {/* Workspace switcher — pick one, only its menu shows below */}
            <div className="flex gap-1.5 overflow-x-auto border-b border-gray-150 px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-dark-600">
              {tree.map((ws) => {
                const on = ws.id === selected?.id;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => setSelectedId(ws.id)}
                    aria-pressed={on}
                    className={clsx(
                      "flex shrink-0 flex-col items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                      on
                        ? "bg-primary-600/10 text-primary-600 dark:text-primary-400"
                        : "text-gray-500 hover:bg-gray-100 dark:text-dark-200 dark:hover:bg-dark-600",
                    )}
                  >
                    <Icon name={ws.icon} className="size-5" />
                    <span className="max-w-[64px] truncate">{ws.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Selected workspace's menu only */}
            <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
              {(selected?.children ?? []).map((item) =>
                item.children?.length ? (
                  <div key={item.id} className="pt-1">
                    <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-dark-400">{item.label}</p>
                    {item.children.map((leaf) => (
                      <div key={leaf.id} className="pl-2">
                        <Leaf item={leaf} pathname={pathname} onNavigate={onClose} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <Leaf key={item.id} item={item} pathname={pathname} onNavigate={onClose} />
                ),
              )}
            </nav>
          </DialogPanel>
        </TransitionChild>
      </Dialog>
    </Transition>
  );
}
