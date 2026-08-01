"use client";

// Slide-over form drawer — mirrors src/components/navigation/SettingsDrawer.tsx
// (Headless UI Dialog + Transition) so the "add-new" forms share the app's
// existing overlay pattern. Sticky header + sticky action bar (Tailux demo feel).
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Fragment, type ReactNode } from "react";
import clsx from "clsx";

export interface FormDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Form body (use FormSection + fields). */
  children: ReactNode;
  /** Submit handler — wire to a native <form> submit. */
  onSubmit?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  /** Disables submit + shows spinner label. */
  submitting?: boolean;
  /** Disable submit (validation not met). */
  submitDisabled?: boolean;
  /** Optional tone note under the action bar (e.g. demo warning). */
  footnote?: ReactNode;
  widthClass?: string;
}

export function FormDrawer({
  open, onClose, title, description, children, onSubmit,
  submitLabel = "Lưu", cancelLabel = "Huỷ", submitting = false, submitDisabled = false, footnote,
  widthClass = "max-w-md",
}: FormDrawerProps) {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={submitting ? () => {} : onClose} className="relative z-100">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm dark:bg-black/50" aria-hidden="true" />
        </TransitionChild>

        <div className="fixed inset-0 flex justify-end">
          <TransitionChild
            as={Fragment}
            enter="transform ease-out duration-250" enterFrom="translate-x-full" enterTo="translate-x-0"
            leave="transform ease-in duration-200" leaveFrom="translate-x-0" leaveTo="translate-x-full"
          >
            <DialogPanel className={clsx("flex h-full w-screen flex-col bg-white shadow-xl dark:bg-dark-700", widthClass)}>
              <form
                className="flex h-full flex-col"
                onSubmit={(e) => { e.preventDefault(); onSubmit?.(); }}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-dark-600">
                  <div className="min-w-0">
                    <DialogTitle className="font-heading text-base font-semibold text-gray-800 dark:text-dark-50">{title}</DialogTitle>
                    {description && <p className="mt-0.5 text-sm text-gray-500 dark:text-dark-300">{description}</p>}
                  </div>
                  <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 dark:hover:bg-dark-600">
                    <XMarkIcon className="size-5" />
                  </button>
                </div>

                {/* Body (scrolls) */}
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">{children}</div>

                {/* Sticky action bar */}
                <div className="border-t border-gray-200 px-5 py-4 dark:border-dark-600">
                  {footnote && <div className="mb-3">{footnote}</div>}
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-dark-500 dark:text-dark-100 dark:hover:bg-dark-600">
                      {cancelLabel}
                    </button>
                    <button type="submit" disabled={submitting || submitDisabled} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50">
                      {submitting && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                      {submitting ? "Đang xử lý…" : submitLabel}
                    </button>
                  </div>
                </div>
              </form>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
