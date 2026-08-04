"use client";

// WF-10 runtime mutations. Client-side fetch with the demo identity headers so
// the backend can scope the write (same pattern as nav preferences).
import { XOFFICE_BASE_CLIENT as API_BASE } from "@/lib/api-base";

export interface Identity {
  tenantId: string;
  userId: string;
}

function headers(identity: Identity): HeadersInit {
  return {
    "content-type": "application/json",
    "x-tenant-id": identity.tenantId,
    "x-user-id": identity.userId,
  };
}

/** POST /tasks/:id/act — approve/reject an open approval task. */
export async function actOnTask(
  identity: Identity,
  taskId: string,
  action: "approve" | "reject",
  note?: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/xoffice/tasks/${encodeURIComponent(taskId)}/act`, {
    method: "POST",
    headers: headers(identity),
    body: JSON.stringify({ action, note }),
  });
  if (!res.ok) throw new Error(`Xử lý task thất bại (${res.status})`);
}

/** POST /workflows/:code/requests — create a demo request to seed the lifecycle. */
export async function createDemoRequest(
  identity: Identity,
  code: string,
  variables: Record<string, unknown>,
  title: string,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/xoffice/workflows/${encodeURIComponent(code)}/requests`,
    {
      method: "POST",
      headers: headers(identity),
      body: JSON.stringify({ variables, title }),
    },
  );
  if (!res.ok) throw new Error(`Tạo request thất bại (${res.status})`);
}
