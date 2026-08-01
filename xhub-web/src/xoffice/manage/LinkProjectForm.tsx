"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import type { ProjectRow } from "@/xoffice/lib/work-projects-data";

/**
 * MG-04 link-only action: attach an EXISTING ExecutionProject to an
 * Initiative. There is deliberately NO "create project" option here — Work v2
 * owns project creation (#17: MG-04 never rebuilds the PM engine).
 */
export function LinkProjectForm({ initiativeId, projects }: { initiativeId: string; projects: ProjectRow[] }) {
  const toast = useToast();
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  async function link() {
    if (!projectId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/manage/initiatives/${initiativeId}/link-project`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ executionProjectId: projectId }),
      });
      if (!res.ok) {
        toast.show("Không gắn được dự án thực thi.", "error");
        return;
      }
      toast.show("Đã gắn dự án thực thi.", "success");
      router.refresh();
    } catch {
      toast.show("Không kết nối được backend.", "info");
    } finally {
      setBusy(false);
    }
  }

  if (projects.length === 0) return <span className="text-xs text-gray-400">Chưa có dự án thực thi nào để gắn.</span>;

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        className="rounded-lg border border-gray-200 px-2 py-1 text-xs dark:border-dark-600 dark:bg-dark-700"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={busy}
        onClick={link}
        className="rounded-lg bg-primary-600 px-2 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {busy ? "…" : "Gắn"}
      </button>
    </div>
  );
}
