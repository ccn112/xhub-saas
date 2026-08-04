import { collection, CANONICAL_TENANT_ID } from "@/xhub/lib/seed";
import { userName } from "@/xhub/lib/repo";
import { byId } from "@/xhub/lib/seed";
import { slaInfo } from "@/xhub/lib/sla";
import type { WorkItem, Project, Customer } from "@/xhub/lib/screen-types";
import { InboxClient, type InboxItem } from "./InboxClient";

export const metadata = { title: "Hộp việc hợp nhất · XHub" };
export const dynamic = "force-dynamic"; // reads the live SoR projection

import { API_BASE_SERVER as API } from "@/lib/api-base";
const STATUS_MAP: Record<string, string> = { open: "needs_action", pending: "needs_action", waiting: "in_progress" };

interface ProjectionItem {
  id: string; type: string; title: string; status: string; priority: string;
  assignedTo?: string | null; dueAt?: string | null;
  sourceSystem: string; sourceType: string; sourceId: string; deepLink?: string | null;
}

/** Live SoR projection (X.Office UnifiedWorkItem). Empty on any failure. */
async function fetchProjection(): Promise<InboxItem[]> {
  try {
    const res = await fetch(`${API}/api/xoffice/work-items`, {
      headers: { "x-tenant-id": CANONICAL_TENANT_ID, "x-user-id": "user-nam" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as ProjectionItem[];
    if (!Array.isArray(rows)) return [];
    return rows.map((w) => {
      const sla = slaInfo(w.dueAt ?? undefined);
      return {
        id: w.id,
        type: w.type === "approval-task" ? "approval" : w.type,
        title: w.title,
        summary: null,
        status: STATUS_MAP[w.status] ?? w.status,
        priority: w.priority ?? "medium",
        dueAt: w.dueAt ?? null,
        assignedToName: w.assignedTo ? userName(w.assignedTo) : "—",
        createdByName: "—",
        projectName: null,
        customerName: null,
        href: w.deepLink ?? null,
        slaLabel: sla.label,
        slaTone: sla.tone,
        overdue: sla.overdue,
        sourceSystem: w.sourceSystem ?? null,
      } satisfies InboxItem;
    });
  } catch {
    return [];
  }
}

export default async function InboxPage() {
  const projection = await fetchProjection();

  // Seed work items — keep the non-approval variety (task/ticket/customer/project)
  // as complementary demo sources; the live SoR projection covers office approvals.
  const seed = collection<WorkItem>("workItems");
  const seedItems: InboxItem[] = seed
    .filter((w) => projection.length === 0 || w.type !== "approval")
    .map((w) => {
      const sla = slaInfo(w.dueAt);
      return {
        id: w.id,
        type: w.type,
        title: w.title,
        summary: w.summary ?? null,
        status: w.status,
        priority: w.priority,
        dueAt: w.dueAt ?? null,
        assignedToName: userName(w.assignedTo),
        createdByName: userName(w.createdBy),
        projectName: w.projectId ? byId<Project>("projects", w.projectId)?.name ?? null : null,
        customerName: w.customerId ? byId<Customer>("customers", w.customerId)?.name ?? null : null,
        href: w.type === "approval" ? `/inbox/${w.id}` : null,
        slaLabel: sla.label,
        slaTone: sla.tone,
        overdue: sla.overdue,
        sourceSystem: null,
      } satisfies InboxItem;
    });

  const items = [...projection, ...seedItems];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Hộp việc hợp nhất</h1>
        <p className="text-sm text-gray-500 dark:text-dark-300">
          Một inbox duy nhất — phê duyệt lấy trực tiếp từ SoR projection (X.Office)
          {projection.length === 0
            ? " · (đang dùng dữ liệu seed do chưa kết nối API)"
            : ` · ${projection.length} việc từ SoR`}
        </p>
      </div>
      <InboxClient items={items} />
    </div>
  );
}
