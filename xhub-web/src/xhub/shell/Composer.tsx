"use client";
import { useState } from "react";

/** Message composer. Client-only interaction; demo does not persist (no backend). */
export function Composer({ channelName }: { channelName: string }) {
  const [value, setValue] = useState("");
  const disabled = value.trim().length === 0;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setValue("");
      }}
      className="rounded-xl border border-gray-200 bg-white p-2 shadow-soft dark:border-dark-600 dark:bg-dark-700"
    >
      <div className="flex items-center gap-1 px-1 pb-1 text-gray-400">
        <button type="button" className="rounded p-1 text-sm hover:bg-gray-100 dark:hover:bg-dark-600" title="Đính kèm">📎</button>
        <button type="button" className="rounded p-1 text-sm hover:bg-gray-100 dark:hover:bg-dark-600" title="Emoji">😊</button>
        <button type="button" className="rounded p-1 text-sm hover:bg-gray-100 dark:hover:bg-dark-600" title="Nhắc tên">@</button>
        <button type="button" className="rounded p-1 text-sm hover:bg-gray-100 dark:hover:bg-dark-600" title="Tạo việc từ tin nhắn">✅</button>
      </div>
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={1}
          placeholder={`Nhắn tới #${channelName}…`}
          className="max-h-40 min-h-10 flex-1 resize-none rounded-lg bg-transparent px-2 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none dark:text-dark-50"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!disabled) setValue("");
            }
          }}
        />
        <button
          type="submit"
          disabled={disabled}
          className="mb-1 shrink-0 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Gửi
        </button>
      </div>
      <p className="px-2 pt-1 text-tiny-plus text-gray-400 dark:text-dark-300">Enter để gửi · Shift+Enter xuống dòng · X.AI chỉ gợi ý, không tự phê duyệt.</p>
    </form>
  );
}
