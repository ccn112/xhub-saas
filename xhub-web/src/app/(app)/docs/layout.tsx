import { ReactNode } from "react";
import { DocsNav } from "@/components/docs/DocsNav";

export const metadata = { title: "Tài liệu · XHub" };

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Tài liệu</h1>
        <p className="text-sm text-gray-500 dark:text-dark-300">
          Hướng dẫn phát triển, hướng dẫn sử dụng và bảng kiểm thử tương tác.
        </p>
      </div>
      <DocsNav />
      {children}
    </div>
  );
}
