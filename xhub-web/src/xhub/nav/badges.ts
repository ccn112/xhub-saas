// Single badge resolver. Values are DERIVED from seed data (tenant-scoped),
// never hardcoded in the navigation config. Renderers read counts only from here.
import { collection } from "@/xhub/lib/seed";
import { CANONICAL_TENANT_ID } from "@/xhub/lib/seed";

interface Approval { status?: string }
interface WorkItem { status?: string; assignedTo?: string }

/** Compute all badge counts once for a tenant. */
export function resolveBadges(
  tenantId: string = CANONICAL_TENANT_ID,
): Record<string, number> {
  const approvals = collection<Approval>("approvals", tenantId);
  const workItems = collection<WorkItem>("workItems", tenantId);
  const directMessages = collection<{ id: string }>("directMessages", tenantId);

  const approvalPending = approvals.filter((a) => a.status === "pending").length;
  const inboxOpen = workItems.filter(
    (w) => w.status !== "done" && w.status !== "closed",
  ).length;
  const spaceUnread = directMessages.length;

  return {
    "approval.pending": approvalPending,
    "inbox.open": inboxOpen,
    "space.unread": spaceUnread,
  };
}

/** Lookup helper — returns 0 when the key has no value. */
export function badgeValue(
  badges: Record<string, number>,
  key?: string,
): number {
  if (!key) return 0;
  return badges[key] ?? 0;
}
