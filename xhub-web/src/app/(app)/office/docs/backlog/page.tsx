import { readFile } from "node:fs/promises";
import path from "node:path";
import { MarkdownDoc } from "@/components/docs/MarkdownDoc";

export const metadata = { title: "Backlog X.Office · X.Office · XHub" };
export const dynamic = "force-dynamic";

// Bản nhân bản riêng cho X.Office (Phase 1.5 Stage D, 2026-08-04) — nguồn
// `docs/XOFFICE_DEV_BACKLOG.md`, tách khỏi bộ chung `docs/DEV_BACKLOG.md`
// (đọc ở /docs/backlog).
async function loadGuide(): Promise<string> {
  const file = path.join(process.cwd(), "docs", "XOFFICE_DEV_BACKLOG.md");
  try {
    return await readFile(file, "utf8");
  } catch {
    return "# Không đọc được tài liệu\n\nKhông tìm thấy `docs/XOFFICE_DEV_BACKLOG.md`.";
  }
}

export default async function XofficeBacklogDocPage() {
  const markdown = await loadGuide();
  return <MarkdownDoc markdown={markdown} />;
}
