"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

// MG-03 — append-only check-in control. No edit/delete UI is offered: history
// is immutable, only new check-ins can be added (Constitution #15 evidence trail).
export function CheckInForm({ okrId, keyResultId, unit }: { okrId: string; keyResultId: string; unit: string }) {
  const toast = useToast();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [confidence, setConfidence] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!value.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/manage/okrs/${okrId}/key-results/${keyResultId}/checkin`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          value: Number(value),
          confidence: confidence ? Number(confidence) / 100 : undefined,
          note: note.trim() || undefined,
        }),
      });
      if (!res.ok) {
        toast.show(res.status === 502 ? "Backend chưa sẵn — check-in KHÔNG được lưu." : "Check-in bị từ chối.", res.status === 502 ? "info" : "error");
        return;
      }
      toast.show(`Đã ghi check-in ${value}${unit}.`, "success");
      setValue(""); setConfidence(""); setNote("");
      router.refresh();
    } catch {
      toast.show("Không kết nối được backend — check-in KHÔNG được lưu.", "info");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Thêm check-in mới</p>
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`Giá trị (${unit})`}
            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-700"
          />
          <input
            type="number"
            min={0}
            max={100}
            value={confidence}
            onChange={(e) => setConfidence(e.target.value)}
            placeholder="Confidence %"
            className="w-32 shrink-0 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-700"
          />
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ghi chú / learning note"
          className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-700"
        />
        <button
          type="button"
          disabled={submitting || !value.trim()}
          onClick={submit}
          className="w-full rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          {submitting ? "Đang lưu…" : "Ghi check-in"}
        </button>
      </div>
    </div>
  );
}
