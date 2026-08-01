"use client";

import { useMemo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";
import "highlight.js/styles/github-dark.css";

import { Card } from "@/xhub/ui/Card";
import { extractToc, nodeText, slugify } from "./slug";

// Anchored heading factory.
function heading(Tag: "h1" | "h2" | "h3" | "h4", cls: string) {
  return function Heading({ children }: { children?: ReactNode }) {
    const id = slugify(nodeText(children));
    return (
      <Tag id={id} className={`group scroll-mt-24 ${cls}`}>
        <a href={`#${id}`} className="no-underline">
          {children}
          <span className="ml-2 text-primary-500 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
            #
          </span>
        </a>
      </Tag>
    );
  };
}

const components: Components = {
  h1: heading("h1", "font-heading mt-2 mb-4 text-2xl font-bold text-gray-800 dark:text-dark-50"),
  h2: heading("h2", "font-heading mt-8 mb-3 border-b border-gray-200 pb-2 text-xl font-semibold text-gray-800 dark:border-dark-500 dark:text-dark-50"),
  h3: heading("h3", "font-heading mt-6 mb-2 text-lg font-semibold text-gray-800 dark:text-dark-100"),
  h4: heading("h4", "font-heading mt-4 mb-2 text-base font-semibold text-gray-700 dark:text-dark-100"),
  p: ({ children }) => <p className="my-3 leading-7 text-gray-600 dark:text-dark-200">{children}</p>,
  a: ({ children, href }) => (
    <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="font-medium text-primary-600 underline decoration-primary-300 underline-offset-2 hover:text-primary-700 dark:text-primary-400">
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="my-3 ml-5 list-disc space-y-1.5 text-gray-600 marker:text-gray-400 dark:text-dark-200">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 ml-5 list-decimal space-y-1.5 text-gray-600 marker:text-gray-400 dark:text-dark-200">{children}</ol>,
  li: ({ children }) => <li className="leading-7">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-4 border-primary-400 bg-primary-50/60 py-1 pl-4 text-gray-600 italic dark:border-primary-500 dark:bg-primary-400/10 dark:text-dark-200">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-gray-200 dark:border-dark-500" />,
  strong: ({ children }) => <strong className="font-semibold text-gray-800 dark:text-dark-50">{children}</strong>,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-dark-500">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-100 dark:bg-dark-800">{children}</thead>,
  th: ({ children }) => <th className="border-b border-gray-200 px-3 py-2 text-left font-semibold text-gray-700 dark:border-dark-500 dark:text-dark-100">{children}</th>,
  td: ({ children }) => <td className="border-b border-gray-100 px-3 py-2 align-top text-gray-600 dark:border-dark-600 dark:text-dark-200">{children}</td>,
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className ?? "");
    if (!isBlock) {
      return <code className="rounded bg-gray-150 px-1.5 py-0.5 font-mono text-[0.85em] text-primary-700 dark:bg-dark-800 dark:text-primary-300">{children}</code>;
    }
    const lang = /language-(\w+)/.exec(className ?? "")?.[1];
    return (
      <span className="relative block">
        {lang && (
          <span className="absolute right-2 top-2 rounded bg-dark-700 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-dark-200 uppercase">
            {lang}
          </span>
        )}
        <code className={`block overflow-x-auto rounded-lg bg-gray-900 p-4 font-mono text-[0.82rem] leading-6 text-gray-100 dark:bg-dark-900 ${className ?? ""}`}>
          {children}
        </code>
      </span>
    );
  },
  pre: ({ children }) => <pre className="my-4">{children}</pre>,
};

export function MarkdownDoc({ markdown }: { markdown: string }) {
  const toc = useMemo(() => extractToc(markdown), [markdown]);

  return (
    <div className="flex gap-6">
      <Card className="min-w-0 flex-1 p-6 sm:p-8">
        <div className="max-w-none break-words">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
            components={components}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      </Card>

      {toc.length > 0 && (
        <aside className="hidden w-56 shrink-0 xl:block">
          <div className="sticky top-4">
            <p className="mb-3 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-dark-300">Trên trang này</p>
            <nav className="space-y-1 border-l border-gray-200 dark:border-dark-500">
              {toc.map((t, i) => (
                <a
                  key={`${t.id}-${i}`}
                  href={`#${t.id}`}
                  className={`block border-l-2 border-transparent py-1 text-sm text-gray-500 transition-colors hover:border-primary-400 hover:text-primary-600 dark:text-dark-300 dark:hover:text-primary-400 ${
                    t.level === 3 ? "pl-6" : "pl-3 font-medium"
                  }`}
                >
                  {t.text}
                </a>
              ))}
            </nav>
          </div>
        </aside>
      )}
    </div>
  );
}
