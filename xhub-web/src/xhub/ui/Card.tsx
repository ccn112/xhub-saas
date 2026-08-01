import { ReactNode } from "react";
import clsx from "clsx";

// Tailux-style surface card (light/dark aware).
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={clsx(
        "rounded-lg border border-gray-200 bg-white shadow-soft dark:border-dark-600 dark:bg-dark-700 dark:shadow-none",
        className,
      )}
    >
      {children}
    </div>
  );
}

export type Accent = "primary" | "success" | "warning" | "error" | "info" | "neutral";

const ACCENTS: Record<Accent, { bar: string; head: string; title: string }> = {
  primary: { bar: "bg-primary-600", head: "bg-primary-600/[0.07] dark:bg-primary-400/10", title: "text-primary-700 dark:text-primary-300" },
  success: { bar: "bg-success", head: "bg-success/10 dark:bg-success/15", title: "text-success-darker dark:text-success-lighter" },
  warning: { bar: "bg-warning", head: "bg-warning/10 dark:bg-warning/15", title: "text-warning-darker dark:text-warning-lighter" },
  error: { bar: "bg-error", head: "bg-error/10 dark:bg-error/15", title: "text-error-darker dark:text-error-lighter" },
  info: { bar: "bg-info", head: "bg-info/10 dark:bg-info/15", title: "text-info-darker dark:text-info-lighter" },
  neutral: { bar: "bg-gray-400 dark:bg-dark-300", head: "bg-gray-100 dark:bg-dark-800/60", title: "text-gray-800 dark:text-dark-100" },
};

export interface SectionCardProps {
  title?: string;
  action?: ReactNode;
  /** Priority accent — tints the header + bar. Default primary. */
  accent?: Accent;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** Card with a tinted, accent-coloured header and a padded body. The header
 * colour encodes priority so the eye can anchor and rank cards at a glance. */
export function SectionCard({ title, action, accent = "primary", className, bodyClassName, children }: SectionCardProps) {
  const a = ACCENTS[accent];
  return (
    <Card className={className}>
      {(title || action) && (
        <div className={clsx("flex min-h-14 items-center justify-between gap-2 rounded-t-lg border-b border-gray-200 px-4 py-3 dark:border-dark-600", a.head)}>
          {title ? (
            <h2 className={clsx("flex items-center gap-2 font-heading text-base font-semibold", a.title)}>
              <span className={clsx("h-4 w-1 shrink-0 rounded-full", a.bar)} aria-hidden="true" />
              {title}
            </h2>
          ) : <span />}
          {action}
        </div>
      )}
      <div className={clsx("p-4", bodyClassName)}>{children}</div>
    </Card>
  );
}
