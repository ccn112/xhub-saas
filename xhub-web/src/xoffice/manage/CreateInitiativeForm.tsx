"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import type { StrategicObjective } from "@/xoffice/lib/manage-data";

export function CreateInitiativeForm({ objectives }: { objectives: StrategicObjective[] }) {
  const toast = useToast();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [objectiveId, setObjectiveId] = useState(objectives[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!code.trim() || !name.trim() || !objectiveId) {
      toast.show("Cần mã, tên và ít nhất 1 mục tiêu chiến lược.", "info");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/manage/initiatives`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.trim(), name: name.trim(), strategicObjectiveIds: [objectiveId] }),
      });
      if (!res.ok) {
        toast.show("Không tạo được initiative (mã có thể đã tồn tại).", "error");
        return;
      }
      toast.show("Đã tạo initiative.", "success");
      setCode(""); setName("");
      router.refresh();
    } catch {
      toast.show("Không kết nối được backend.", "info");
    } finally {
      setSubmitting(false);
    }
  }

  if (objectives.length === 0) {
    return <p className="text-sm text-gray-400">Cần ít nhất 1 mục tiêu chiến lược (Quản trị → Mục tiêu) trước khi tạo initiative.</p>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-4 sm:items-end">
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-dark-300">Mã</span>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="INIT-01" className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-700" />
      </label>
      <label className="block text-sm sm:col-span-1">
        <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-dark-300">Tên</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên initiative" className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-700" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-dark-300">Mục tiêu chiến lược</span>
        <select value={objectiveId} onChange={(e) => setObjectiveId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm dark:border-dark-600 dark:bg-dark-700">
          {objectives.map((o) => (
            <option key={o.id} value={o.id}>{o.code} · {o.name}</option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={submitting}
        onClick={submit}
        className="h-fit rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {submitting ? "Đang tạo…" : "Tạo initiative"}
      </button>
    </div>
  );
}
