"use client";

// Import Dependencies
import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react";
import {
  ArrowLeftStartOnRectangleIcon,
  Cog6ToothIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Local Imports
import { Button } from "@/components/ui";
import { useNavigation } from "@/xhub/nav/NavigationProvider";

// Initials from a display name (fallback "NC").
function initials(name?: string): string {
  if (!name) return "NC";
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1]?.[0] ?? "";
  const first = parts[0]?.[0] ?? "";
  return (first + last).toUpperCase() || "NC";
}

// ----------------------------------------------------------------------

interface LinkItem {
  id: string;
  title: string;
  description: string;
  to: string;
  Icon: React.ElementType;
}

const links: LinkItem[] = [
  {
    id: "1",
    title: "Hồ sơ",
    description: "Thiết lập hồ sơ của bạn",
    to: "/home/me",
    Icon: UserIcon,
  },
];

// ----------------------------------------------------------------------

export function Profile() {
  const { openSettings, identity } = useNavigation();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const displayName = identity.name ?? "Nguyễn Chính";
  const displayTitle = identity.title ?? "Điều hành";
  const badge = initials(identity.name);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* ignore — clear client state regardless */
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <Popover className="relative">
      <PopoverButton
        as="button"
        className="dark:ring-dark-400 flex size-10 cursor-pointer items-center justify-center rounded-full bg-primary-600 font-heading text-sm font-semibold text-white outline-hidden ring-primary-600/30 focus:ring-3"
      >
        {badge}
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
          className="border-gray-150 shadow-soft dark:border-dark-600 dark:bg-dark-700 z-70 flex w-64 flex-col rounded-lg border bg-white transition dark:shadow-none"
        >
          {({ close }) => (
            <>
              <div className="dark:bg-dark-800 flex items-center gap-4 rounded-t-lg bg-gray-100 px-4 py-5">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary-600 font-heading font-semibold text-white">
                  {badge}
                </div>
                <div>
                  <span className="dark:text-dark-100 text-base font-medium text-gray-700">
                    {displayName}
                  </span>
                  <p className="dark:text-dark-300 mt-0.5 text-xs text-gray-400">
                    {displayTitle}
                  </p>
                </div>
              </div>

              <div className="flex flex-col pt-2 pb-5">
                {links.map((link) => (
                  <Link
                    key={link.id}
                    href={link.to}
                    onClick={() => close()}
                    className="group dark:hover:bg-dark-600 dark:focus:bg-dark-600 flex items-center gap-3 px-4 py-2 tracking-wide outline-hidden transition-all hover:bg-gray-100 focus:bg-gray-100"
                  >
                    <div className="dark:bg-dark-600 flex size-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:text-dark-200">
                      <link.Icon className="size-4.5" />
                    </div>
                    <div>
                      <h2 className="dark:text-dark-100 dark:group-hover:text-primary-400 font-medium text-gray-800 transition-colors group-hover:text-primary-600">
                        {link.title}
                      </h2>
                      <div className="dark:text-dark-300 truncate text-xs text-gray-400">
                        {link.description}
                      </div>
                    </div>
                  </Link>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    close();
                    openSettings();
                  }}
                  className="group dark:hover:bg-dark-600 dark:focus:bg-dark-600 flex items-center gap-3 px-4 py-2 text-start tracking-wide outline-hidden transition-all hover:bg-gray-100 focus:bg-gray-100"
                >
                  <div className="dark:bg-dark-600 flex size-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:text-dark-200">
                    <Cog6ToothIcon className="size-4.5" />
                  </div>
                  <div>
                    <h2 className="dark:text-dark-100 dark:group-hover:text-primary-400 font-medium text-gray-800 transition-colors group-hover:text-primary-600">
                      Cài đặt cá nhân
                    </h2>
                    <div className="dark:text-dark-300 truncate text-xs text-gray-400">
                      Giao diện, kiểu điều hướng, mật độ
                    </div>
                  </div>
                </button>

                <div className="px-4 pt-4">
                  <Button
                    className="w-full gap-2"
                    disabled={signingOut}
                    onClick={() => {
                      close();
                      void handleLogout();
                    }}
                  >
                    <ArrowLeftStartOnRectangleIcon className="size-4.5" />
                    <span>{signingOut ? "Đang đăng xuất…" : "Đăng xuất"}</span>
                  </Button>
                </div>
              </div>
            </>
          )}
        </PopoverPanel>
      </Transition>
    </Popover>
  );
}
