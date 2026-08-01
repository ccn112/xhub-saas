import { Card } from "./Card";
import clsx from "clsx";
import type { Tone } from "./Badge";

const iconTone: Record<Tone, string> = {
  primary: "bg-primary-600/10 text-primary-600 dark:text-primary-400",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  error: "bg-error/10 text-error",
  info: "bg-info/10 text-info",
  neutral: "bg-gray-150 text-gray-600 dark:bg-dark-500 dark:text-dark-100",
};

export interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: string; // emoji or short glyph
  tone?: Tone;
}

/** KPI tile. `icon` is a small glyph/emoji (no external icon dep required). */
export function StatCard({ label, value, sub, icon = "•", tone = "primary" }: StatCardProps) {
  return (
    <Card className="h-full p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium tracking-wide text-gray-400 uppercase sm:text-xs-plus dark:text-dark-300">{label}</p>
          <p className="font-heading mt-1 text-lg font-semibold text-gray-800 sm:mt-2 sm:text-2xl dark:text-dark-50">{value}</p>
          {sub ? <p className="mt-0.5 text-[11px] text-gray-400 sm:mt-1 sm:text-xs dark:text-dark-300">{sub}</p> : null}
        </div>
        <span className={clsx("flex size-8 shrink-0 items-center justify-center rounded-lg text-base sm:size-10 sm:text-lg", iconTone[tone])}>{icon}</span>
      </div>
    </Card>
  );
}
