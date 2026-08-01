// Shared shell for the public auth pages (login / activate / forgot / reset /
// select-tenant). Centered Tailux card, light/dark, responsive. Server-safe.
import type { ReactNode } from "react";
import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-8">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">X</span>
          <span className="text-sm font-semibold tracking-tight text-slate-500 dark:text-slate-400">XHub</span>
        </div>
        <h1 className="mt-5 text-xl font-semibold text-slate-900 dark:text-slate-50">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        {children}
        {footer && <div className="mt-6 border-t border-slate-100 pt-4 text-center text-sm dark:border-slate-800">{footer}</div>}
      </div>
    </main>
  );
}

export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400">
      {children}
    </Link>
  );
}
