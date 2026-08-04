import { readFile } from "node:fs/promises";
import path from "node:path";
import { MarkdownDoc } from "@/components/docs/MarkdownDoc";

export const metadata = { title: "Phát triển X.Office · X.Office · XHub" };
export const dynamic = "force-dynamic";

// Bản nhân bản riêng cho X.Office (Phase 1.5 Stage D, 2026-08-04) — nguồn
// `docs/XOFFICE_DEVELOPER_GUIDE.md`, tách khỏi bộ chung `docs/DEVELOPER_GUIDE.md`
// (đọc ở /docs/developer).
async function loadGuide(): Promise<string> {
  const file = path.join(process.cwd(), "docs", "XOFFICE_DEVELOPER_GUIDE.md");
  try {
    return await readFile(file, "utf8");
  } catch {
    return "# Không đọc được tài liệu\n\nKhông tìm thấy `docs/XOFFICE_DEVELOPER_GUIDE.md`.";
  }
}

export default async function XofficeDeveloperDocPage() {
  const markdown = await loadGuide();
  return <MarkdownDoc markdown={markdown} />;
}
