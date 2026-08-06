"use client";

// Shared destructive-action confirm dialog — mirrors Tailux's ConfirmModal
// pattern (pending → confirming → error), Headless UI Dialog/Transition like
// FormDrawer.tsx, centered (not a drawer) since this is a short yes/no gate.
//
// Locked decision 05/08/2026 (docs/design-system/TAILUX_PAGE_PATTERNS.md,
// "Quy tắc chọn pattern" #3): EVERY delete in XHub goes through this dialog —
// no page deletes straight, unlike the Tailux demo where popup-form deletes
// skip confirmation. For financial/sensitive records (contract, invoice,
// payment...), pass `typedConfirmation` to require re-typing the record's own
// code before the confirm button enables — a stricter gate than a plain
// Yes/No, matching the owner's explicit call for "xác nhận kiểu gõ lại mã".
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Fragment, useEffect, useState } from "react";
import clsx from "clsx";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /** May throw — the dialog surfaces the error and stays open so the user can retry. */
  onConfirm: () => Promise<void> | void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "error" | "warning" | "primary";
  /**
   * Financial/sensitive records — require the user to re-type the record's
   * own code (e.g. contract number) before the confirm button enables.
   * `code` is the exact string the input must match; `hint` is an optional
   * short parenthetical shown next to the instruction (e.g. the record name).
   */
  typedConfirmation?: { code: string; hint?: string };
}

const TONE_STYLES: Record<NonNullable<ConfirmDialogProps["tone"]>, { iconWrap: string; icon: string; button: string }> = {
  error: { iconWrap: "bg-error/10", icon: "text-error", button: "bg-error hover:bg-error-darker" },
  warning: { iconWrap: "bg-warning/10", icon: "text-warning", button: "bg-warning hover:bg-warning-darker" },
  primary: { iconWrap: "bg-primary-600/10", icon: "text-primary-600", button: "bg-primary-600 hover:bg-primary-700" },
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Xoá",
  cancelLabel = "Huỷ",
  tone = "error",
  typedConfirmation,
}: ConfirmDialogProps) {
  const [state, setState] = useState<"idle" | "confirming" | "error">("idle");
  const [typedValue, setTypedValue] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Reset every time the dialog re-opens — a stale typed value or error from
  // a previous record must never carry over.
  useEffect(() => {
    if (open) {
      setState("idle");
      setTypedValue("");
      setErrorMessage("");
    }
  }, [open]);

  const gated = !!typedConfirmation;
  const canConfirm = !gated || typedValue.trim() === typedConfirmation!.code;
  const styles = TONE_STYLES[tone];

  async function handleConfirm() {
    setState("confirming");
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setState("error");
      setErrorMessage(e instanceof Error ? e.message : "Không thực hiện được — thử lại.");
    }
  }

  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={state === "confirming" ? () => {} : onClose} className="relative z-100">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm dark:bg-black/50" aria-hidden="true" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
            leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-dark-700">
              <div className={clsx("mb-3 flex size-10 items-center justify-center rounded-full", styles.iconWrap)}>
                <ExclamationTriangleIcon className={clsx("size-5", styles.icon)} />
              </div>
              <DialogTitle className="font-heading text-base font-semibold text-gray-800 dark:text-dark-50">{title}</DialogTitle>
              <p className="mt-1.5 text-sm text-gray-500 dark:text-dark-300">{description}</p>

              {gated && (
                <div className="mt-4">
                  <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-dark-200">
                    Gõ lại{" "}
                    <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs text-gray-800 dark:bg-dark-800 dark:text-dark-50">
                      {typedConfirmation!.code}
                    </code>{" "}
                    để xác nhận
                    {typedConfirmation!.hint ? <span className="ml-1 text-gray-400">({typedConfirmation!.hint})</span> : null}
                  </label>
                  <input
                    value={typedValue}
                    onChange={(e) => setTypedValue(e.target.value)}
                    placeholder={typedConfirmation!.code}
                    autoComplete="off"
                    disabled={state === "confirming"}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:opacity-60 dark:border-dark-500 dark:bg-dark-800 dark:text-dark-50"
                  />
                </div>
              )}

              {state === "error" && (
                <p className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-xs text-error-darker dark:text-error-lighter">{errorMessage}</p>
              )}

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={state === "confirming"}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-dark-500 dark:text-dark-100 dark:hover:bg-dark-600"
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!canConfirm || state === "confirming"}
                  className={clsx(
                    "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    styles.button,
                  )}
                >
                  {state === "confirming" && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                  {state === "confirming" ? "Đang xử lý…" : confirmLabel}
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
