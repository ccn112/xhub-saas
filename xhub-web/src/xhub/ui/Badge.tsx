import { ReactNode } from "react";
import clsx from "clsx";

export type Tone = "primary" | "success" | "warning" | "error" | "info" | "neutral";

const tones: Record<Tone, string> = {
  primary: "bg-primary-600/10 text-primary-700 dark:bg-primary-400/15 dark:text-primary-300",
  success: "bg-success/10 text-success-darker dark:bg-success/15 dark:text-success-lighter",
  warning: "bg-warning/10 text-warning-darker dark:bg-warning/15 dark:text-warning-lighter",
  error: "bg-error/10 text-error-darker dark:bg-error/15 dark:text-error-lighter",
  info: "bg-info/10 text-info-darker dark:bg-info/15 dark:text-info-lighter",
  neutral: "bg-gray-150 text-gray-700 dark:bg-dark-500 dark:text-dark-100",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}
