import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownDoc } from "@/components/docs/MarkdownDoc";
import { findSaasDoc } from "@/features/docs/saas-docs";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = findSaasDoc(slug);
  return { title: `${doc?.title ?? "SaaS"} · Tài liệu · XHub` };
}

export default async function SaasDocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = findSaasDoc(slug);
  if (!doc) notFound();

  let markdown: string;
  try {
    markdown = await readFile(path.join(process.cwd(), "docs", "saas", doc.file), "utf8");
  } catch {
    markdown = `# Không đọc được tài liệu\n\nKhông tìm thấy \`docs/saas/${doc.file}\`.`;
  }

  return (
    <div className="space-y-4">
      <Link
        href="/docs/saas"
        className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
      >
        ← Danh sách SaaS
      </Link>
      <MarkdownDoc markdown={markdown} />
    </div>
  );
}
