import { readFile } from "node:fs/promises";
import path from "node:path";
import { MarkdownDoc } from "@/components/docs/MarkdownDoc";

export const metadata = { title: "Backlog · Tài liệu · XHub" };
export const dynamic = "force-dynamic";

async function loadGuide(): Promise<string> {
  // Read the single-source markdown from disk at request time. Path is resolved
  // relative to the Next server working directory (the xhub-web root).
  const file = path.join(process.cwd(), "docs", "DEV_BACKLOG.md");
  try {
    return await readFile(file, "utf8");
  } catch {
    return "# Không đọc được tài liệu\n\nKhông tìm thấy `docs/DEV_BACKLOG.md`.";
  }
}

export default async function BacklogDocPage() {
  const markdown = await loadGuide();
  return <MarkdownDoc markdown={markdown} />;
}
