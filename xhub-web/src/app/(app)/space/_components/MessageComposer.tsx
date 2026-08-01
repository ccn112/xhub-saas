"use client";

import { useState } from "react";

export function MessageComposer({
  placeholder = "Nhập nội dung…",
  hint = "AI chỉ hỗ trợ soạn/tóm tắt — không tự gửi hay phê duyệt.",
}: {
  placeholder?: string;
  hint?: string;
}) {
  const [value, setValue] = useState("");
  const disabled = value.trim().length === 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2 focus-within:border-primary-400 dark:border-dark-600 dark:bg-dark-700">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="w-full resize-none bg-transparent px-2 py-1 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none dark:text-dark-100"
      />
      <div className="mt-1 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1 text-gray-400">
          <button type="button" aria-label="Đính kèm tệp" className="rounded p-1 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-dark-600">📎</button>
          <button type="button" aria-label="Chèn emoji" className="rounded p-1 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-dark-600">🙂</button>
          <button type="button" aria-label="Nhắc việc" className="rounded p-1 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-dark-600">✅</button>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-gray-400 sm:inline dark:text-dark-300">{hint}</span>
          <button
            type="button"
            disabled={disabled}
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Gửi
          </button>
        </div>
      </div>
    </div>
  );
}
