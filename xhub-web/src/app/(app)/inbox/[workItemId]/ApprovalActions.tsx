"use client";

import { useState } from "react";
import { Badge } from "@/xhub/ui/Badge";

/**
 * Khu hành động phê duyệt (client). Có xác nhận rõ ràng + ghi chú audit.
 * AI KHÔNG tự phê duyệt — người dùng phải bấm và xác nhận thủ công.
 */
export function ApprovalActions({ code, stepName, approverName }: { code: string; stepName: string; approverName: string }) {
  const [mode, setMode] = useState<null | "approve" | "reject">(null);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<null | { action: "approve" | "reject"; note: string; at: string }>(null);

  if (result) {
    const ok = result.action === "approve";
    return (
      <div className={`rounded-lg border p-4 ${ok ? "border-success/40 bg-success/5" : "border-error/40 bg-error/5"}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{ok ? "✅" : "⛔"}</span>
          <p className="font-heading text-sm font-semibold text-gray-800 dark:text-dark-50">
            {ok ? "Đã ghi nhận phê duyệt" : "Đã ghi nhận từ chối"} · {code}
          </p>
        </div>
        <p className="mt-2 text-sm text-gray-600 dark:text-dark-200">Bước: {stepName} · Người xử lý: {approverName}</p>
        {result.note ? <p className="mt-1 text-sm text-gray-600 dark:text-dark-200">Ghi chú: “{result.note}”</p> : null}
        <p className="mt-2 text-xs text-gray-400">Bản demo: hành động được ghi vào nhật ký kiểm toán (audit log), không gọi ERP thật.</p>
        <button type="button" onClick={() => { setResult(null); setMode(null); setNote(""); }} className="mt-3 text-sm text-primary-600 hover:underline">
          Hoàn tác thao tác demo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-dark-100">Bước hiện tại: {stepName}</p>
          <p className="text-xs text-gray-400">Người phê duyệt: {approverName}</p>
        </div>
        <Badge tone="warning">Chờ quyết định</Badge>
      </div>

      {mode === null ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => setMode("approve")} className="flex-1 rounded-lg bg-success px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success">
            Duyệt
          </button>
          <button type="button" onClick={() => setMode("reject")} className="flex-1 rounded-lg border border-error/50 px-4 py-2.5 text-sm font-semibold text-error hover:bg-error/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error">
            Từ chối
          </button>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-dark-600">
          <p className="text-sm font-medium text-gray-800 dark:text-dark-50">
            Xác nhận {mode === "approve" ? "PHÊ DUYỆT" : "TỪ CHỐI"} yêu cầu {code}?
          </p>
          <label className="block text-xs font-medium text-gray-500 dark:text-dark-300">
            Ghi chú {mode === "reject" ? "(bắt buộc khi từ chối)" : "(tuỳ chọn, lưu vào audit)"}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 text-sm text-gray-800 focus:border-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-dark-600 dark:bg-dark-700 dark:text-dark-100"
              placeholder={mode === "approve" ? "Ví dụ: Đã đối chiếu nghiệm thu, đồng ý thanh toán đợt 2." : "Nêu lý do từ chối / yêu cầu bổ sung."}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={mode === "reject" && note.trim() === ""}
              onClick={() => setResult({ action: mode, note: note.trim(), at: "now" })}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 ${
                mode === "approve" ? "bg-success focus-visible:ring-success" : "bg-error focus-visible:ring-error"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Xác nhận {mode === "approve" ? "duyệt" : "từ chối"}
            </button>
            <button type="button" onClick={() => { setMode(null); setNote(""); }} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-dark-600 dark:text-dark-200">
              Huỷ
            </button>
          </div>
        </div>
      )}
      <p className="text-xs text-gray-400 italic">X.AI chỉ tóm tắt & cảnh báo — quyết định phê duyệt do người dùng thực hiện thủ công.</p>
    </div>
  );
}
