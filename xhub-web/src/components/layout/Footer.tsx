import Link from "next/link";

// App footer — pinned to the bottom of the viewport by the flex-column shell
// (see AppShell). Hidden below md so it never collides with the mobile bottom
// navigation. Offset to clear the fixed sidebar via the `.app-footer` class
// (same rules as `.app-header` / `main.main-content`).
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0";

export function Footer() {
  return (
    <footer className="app-footer transition-content hidden shrink-0 border-t border-gray-200 bg-white/80 px-4 py-2.5 backdrop-blur-sm md:flex md:items-center md:justify-between md:px-6 lg:px-8 dark:border-dark-600 dark:bg-dark-900/80">
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-dark-300">
        <span className="flex size-5 items-center justify-center rounded bg-primary-600 font-heading text-[10px] font-bold text-white">
          X
        </span>
        <span className="font-medium text-gray-700 dark:text-dark-100">XHub · X.Space</span>
        <span className="text-gray-300 dark:text-dark-500">·</span>
        <span>Phiên bản {APP_VERSION}</span>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-dark-300">
        <Link href="/docs" className="transition-colors hover:text-primary-600 dark:hover:text-primary-400">
          Tài liệu
        </Link>
        <Link href="/docs/test" className="transition-colors hover:text-primary-600 dark:hover:text-primary-400">
          Trợ giúp
        </Link>
        <Link href="/terms" className="transition-colors hover:text-primary-600 dark:hover:text-primary-400">
          Điều khoản
        </Link>
        <span className="text-gray-400 dark:text-dark-400">© 2026 X-TECH</span>
      </div>
    </footer>
  );
}
