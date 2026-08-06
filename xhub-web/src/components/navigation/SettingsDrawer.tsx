"use client";

// "Cài đặt cá nhân" drawer — unified personal settings:
//   • Kiểu điều hướng (navigation mode) — optimistic apply + PATCH, rollback+toast
//   • Giao diện (theme mode + màu chủ đạo) — preserves the Customizer feature set
//   • Mật độ (density)
//   • Ngôn ngữ (2026-08-06) — cookie-based locale (see src/i18n/*), instant
//     apply via a Server Action + router.refresh(), same "no reload" feel as
//     the sections above. Only nav/home/Kinh doanh are translated so far.
import {
  Dialog,
  DialogPanel,
  Label,
  Radio,
  RadioGroup,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useThemeContext } from "@/contexts/theme/context";
import { colors } from "@/constants/colors";
import { setLocale } from "@/i18n/actions";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/locales";
import { Button } from "@/components/ui";
import { useNavigation } from "@/xhub/nav/NavigationProvider";
import type { NavigationMode, DensityMode } from "@/xhub/nav/types";
import type { PrimaryColor } from "@/configs/@types/theme";

const MODE_META: Record<
  NavigationMode,
  { title: string; description: string }
> = {
  "rail-context": {
    title: "Gọn theo ngữ cảnh",
    description: "Thanh biểu tượng + bảng ngữ cảnh",
  },
  expanded: {
    title: "Menu đầy đủ",
    description: "Một sidebar hiển thị toàn bộ menu",
  },
};

const primaryColors: Exclude<PrimaryColor, "default">[] = [
  "indigo",
  "blue",
  "green",
  "amber",
  "purple",
  "rose",
];

const densities: { value: DensityMode; label: string }[] = [
  { value: "comfortable", label: "Thoải mái" },
  { value: "compact", label: "Gọn" },
];

function ModePreview({ mode }: { mode: NavigationMode }) {
  if (mode === "rail-context") {
    return (
      <div className="flex h-12 w-full gap-1 overflow-hidden rounded-md border border-gray-200 p-1 dark:border-dark-500">
        <div className="w-2.5 rounded-sm bg-primary-600/70" />
        <div className="w-5 rounded-sm bg-gray-200 dark:bg-dark-500" />
        <div className="flex-1 rounded-sm bg-gray-100 dark:bg-dark-600" />
      </div>
    );
  }
  return (
    <div className="flex h-12 w-full gap-1 overflow-hidden rounded-md border border-gray-200 p-1 dark:border-dark-500">
      <div className="w-8 space-y-0.5 rounded-sm bg-primary-600/70 p-0.5">
        <div className="h-1 rounded-full bg-white/70" />
        <div className="h-1 rounded-full bg-white/50" />
        <div className="h-1 rounded-full bg-white/50" />
      </div>
      <div className="flex-1 rounded-sm bg-gray-100 dark:bg-dark-600" />
    </div>
  );
}

export function SettingsDrawer() {
  const { isSettingsOpen, closeSettings, savedMode, setMode, allowedModes, pending, density, setDensity } =
    useNavigation();
  const theme = useThemeContext();

  const locale = useLocale() as Locale;
  const tSettings = useTranslations("settings");
  const router = useRouter();
  const [pendingLocale, setPendingLocale] = useState<Locale | null>(null);
  const [, startLocaleTransition] = useTransition();

  function handleLocaleChange(next: Locale) {
    if (next === locale) return;
    setPendingLocale(next);
    startLocaleTransition(async () => {
      await setLocale(next);
      router.refresh();
      setPendingLocale(null);
    });
  }

  return (
    <Transition show={isSettingsOpen}>
      <Dialog onClose={closeSettings} static autoFocus>
        <TransitionChild
          as="div"
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          className="fixed inset-0 z-[80] bg-gray-900/50 transition-opacity dark:bg-black/40"
        />
        <TransitionChild
          as={DialogPanel}
          enter="ease-out transform-gpu transition-transform duration-200"
          enterFrom="translate-x-full"
          enterTo="translate-x-0"
          leave="ease-in transform-gpu transition-transform duration-200"
          leaveFrom="translate-x-0"
          leaveTo="translate-x-full"
          className="fixed inset-y-0 right-0 z-[81] flex w-screen transform-gpu flex-col bg-white transition-transform duration-200 sm:inset-y-2 sm:mx-2 sm:w-80 sm:rounded-xl dark:bg-dark-750"
        >
          <div className="flex items-center justify-between px-4 py-3">
            <span className="font-medium text-gray-800 dark:text-dark-50">
              Cài đặt cá nhân
            </span>
            <Button
              onClick={closeSettings}
              variant="flat"
              isIcon
              className="size-7 rounded-full"
            >
              <XMarkIcon className="size-4" />
            </Button>
          </div>

          <div className="custom-scrollbar h-auto overflow-y-auto px-4 pb-6">
            {/* Navigation mode */}
            <div className="mt-1">
              <p className="font-medium text-gray-800 dark:text-dark-100">
                Kiểu điều hướng
              </p>
              <div className="mt-2.5 space-y-2.5">
                {allowedModes.map((mode) => {
                  const meta = MODE_META[mode];
                  const active = savedMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      disabled={pending}
                      onClick={() => !active && setMode(mode)}
                      aria-pressed={active}
                      className={clsx(
                        "flex w-full items-center gap-3 rounded-lg border p-2.5 text-start outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-primary-600/60 disabled:opacity-60",
                        active
                          ? "border-primary-600 bg-primary-600/5"
                          : "border-gray-200 hover:border-gray-300 dark:border-dark-500 dark:hover:border-dark-400",
                      )}
                    >
                      <div className="w-16 shrink-0">
                        <ModePreview mode={mode} />
                      </div>
                      <div className="min-w-0">
                        <p
                          className={clsx(
                            "text-sm font-medium",
                            active
                              ? "text-primary-600 dark:text-primary-400"
                              : "text-gray-800 dark:text-dark-100",
                          )}
                        >
                          {meta.title}
                        </p>
                        <p className="truncate text-tiny-plus text-gray-500 dark:text-dark-300">
                          {meta.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Theme mode */}
            <RadioGroup
              value={theme.themeMode}
              onChange={theme.setThemeMode}
              className="mt-5"
            >
              <Label className="font-medium text-gray-800 dark:text-dark-100">
                Giao diện
              </Label>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {(["system", "light", "dark"] as const).map((m) => (
                  <Radio
                    key={m}
                    value={m}
                    className={({ checked }) =>
                      clsx(
                        "cursor-pointer rounded-lg border py-2 text-center text-xs-plus outline-hidden",
                        checked
                          ? "border-primary-600 text-primary-600 dark:text-primary-400"
                          : "border-gray-200 text-gray-600 dark:border-dark-500 dark:text-dark-200",
                      )
                    }
                  >
                    {m === "system" ? "Hệ thống" : m === "light" ? "Sáng" : "Tối"}
                  </Radio>
                ))}
              </div>
            </RadioGroup>

            {/* Primary color */}
            <RadioGroup
              value={theme.primaryColorScheme.name}
              onChange={theme.setPrimaryColorScheme}
              className="mt-5"
            >
              <Label className="font-medium text-gray-800 dark:text-dark-100">
                Màu chủ đạo
              </Label>
              <div className="mt-2 flex flex-wrap gap-3">
                {primaryColors.map((color) => (
                  <Radio
                    key={color}
                    value={color}
                    className={({ checked }) =>
                      clsx(
                        "flex size-10 cursor-pointer items-center justify-center rounded-lg border outline-hidden",
                        checked
                          ? "border-primary-500"
                          : "border-gray-200 dark:border-dark-500",
                      )
                    }
                  >
                    <span
                      className="size-5 rounded-md"
                      style={{ backgroundColor: colors[color][500] }}
                    />
                  </Radio>
                ))}
              </div>
            </RadioGroup>

            {/* Density */}
            <RadioGroup
              value={density}
              onChange={setDensity}
              className="mt-5"
            >
              <Label className="font-medium text-gray-800 dark:text-dark-100">
                Mật độ
              </Label>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                {densities.map((d) => (
                  <Radio
                    key={d.value}
                    value={d.value}
                    className={({ checked }) =>
                      clsx(
                        "cursor-pointer rounded-lg border py-2 text-center text-xs-plus outline-hidden",
                        checked
                          ? "border-primary-600 text-primary-600 dark:text-primary-400"
                          : "border-gray-200 text-gray-600 dark:border-dark-500 dark:text-dark-200",
                      )
                    }
                  >
                    {d.label}
                  </Radio>
                ))}
              </div>
            </RadioGroup>

            {/* Language — cookie-based, no URL prefix; see src/i18n/*. */}
            <RadioGroup
              value={locale}
              onChange={handleLocaleChange}
              className="mt-5"
            >
              <Label className="font-medium text-gray-800 dark:text-dark-100">
                {tSettings("language")}
              </Label>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                {LOCALES.map((l) => (
                  <Radio
                    key={l}
                    value={l}
                    disabled={pendingLocale !== null}
                    className={({ checked }) =>
                      clsx(
                        "cursor-pointer rounded-lg border py-2 text-center text-xs-plus outline-hidden disabled:cursor-not-allowed disabled:opacity-60",
                        checked
                          ? "border-primary-600 text-primary-600 dark:text-primary-400"
                          : "border-gray-200 text-gray-600 dark:border-dark-500 dark:text-dark-200",
                      )
                    }
                  >
                    {pendingLocale === l ? "…" : LOCALE_LABELS[l]}
                  </Radio>
                ))}
              </div>
              <p className="mt-2 text-tiny-plus text-gray-400 dark:text-dark-400">
                {tSettings("languageHint")}
              </p>
            </RadioGroup>
          </div>
        </TransitionChild>
      </Dialog>
    </Transition>
  );
}
