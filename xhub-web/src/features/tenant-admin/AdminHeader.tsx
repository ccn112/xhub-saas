import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, type Tone } from "@/xhub/ui/Badge";

/** Consistent admin screen header: title + subtitle + optional back link + status chip. */
export function AdminHeader({
  title, subtitle, back, chip,
}: {
  title: string;
  subtitle?: string;
  back?: { href: string; label: string };
  chip?: { label: string; tone: Tone };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {back ? (
          <Link href={back.href} className="mb-1 inline-block text-sm text-primary-600 hover:underline">← {back.label}</Link>
        ) : null}
        <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">{title}</h1>
        {subtitle ? <p className="text-sm text-gray-500 dark:text-dark-300">{subtitle}</p> : null}
      </div>
      {chip ? <Badge tone={chip.tone}>{chip.label}</Badge> : null}
    </div>
  );
}

/** Small definition row used across detail panes. */
export function DefRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-gray-400">{label}</dt>
      <dd className="text-right font-medium text-gray-700 dark:text-dark-100">{value}</dd>
    </div>
  );
}
