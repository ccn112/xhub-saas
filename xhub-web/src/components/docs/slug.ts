import type { ReactNode } from "react";

// Slugify a heading (Vietnamese-aware): strip diacritics, keep a-z0-9, dash the rest.
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Recursively pull plain text out of react-markdown children.
export function nodeText(node: ReactNode): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (typeof node === "object" && "props" in (node as object)) {
    return nodeText((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

// Extract a right-hand TOC (h2 + h3) from the raw markdown string.
export function extractToc(markdown: string): TocEntry[] {
  const out: TocEntry[] = [];
  let inFence = false;
  for (const raw of markdown.split(/\r?\n/)) {
    if (/^\s*```/.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(raw);
    if (!m) continue;
    const level = m[1].length as 2 | 3;
    const text = m[2].replace(/`/g, "").trim();
    out.push({ id: slugify(text), text, level });
  }
  return out;
}
