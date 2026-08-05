// Customer/Contact module — server-side data access (:4001, tenant-scoped,
// Phase 2 BO-0201). Reuses the XOffice tenant context. We do NOT fall back
// to demo data: the list degrades to an empty array with source='offline'
// (dev only). Mirrors announcements-data.ts.
import { xofficeContext, type XOfficeContext } from "./workflow-data";
import { XOFFICE_BASE_SERVER as API_BASE } from "@/lib/api-base";

export interface ContactRow {
  id: string;
  customerId: string;
  displayName: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  contactPreference: string[];
  consentEvidenceRef?: string | null;
  isPrimary: boolean;
  notes?: string | null;
  createdAt: string;
}

export interface CustomerRow {
  id: string;
  code: string;
  name: string;
  status: string;
  canonicalCustomerId?: string | null;
  ownerIdentityId?: string | null;
  industryCode?: string | null;
  privacyClass?: string | null;
  taxCode?: string | null;
  addressLine?: string | null;
  website?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  contacts?: ContactRow[];
}

export interface CustomerEventRow {
  id: string;
  type: string;
  actorId: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface CustomerDetail {
  customer: CustomerRow;
  contacts: ContactRow[];
  events: CustomerEventRow[];
}

async function get<T>(path: string, ctx: XOfficeContext): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "x-tenant-id": ctx.tenantId, "x-user-id": ctx.userId, "content-type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function listCustomers(
  filters: { status?: string; q?: string } = {},
): Promise<{ items: CustomerRow[]; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = xofficeContext();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v != null && v !== "") qs.set(k, String(v));
  const data = await get<CustomerRow[]>(`/api/customers?${qs.toString()}`, ctx);
  return { items: Array.isArray(data) ? data : [], source: data ? "api" : "offline", ctx };
}

export async function getCustomer(
  id: string,
): Promise<{ detail: CustomerDetail | null; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = xofficeContext();
  const detail = await get<CustomerDetail>(`/api/customers/${id}`, ctx);
  return { detail, source: detail ? "api" : "offline", ctx };
}

export const CUSTOMER_STATUS_LABEL: Record<string, string> = {
  PROSPECT: "Tiềm năng", ACTIVE: "Đang hoạt động", INACTIVE: "Ngừng hoạt động", BLOCKED: "Bị chặn",
};

export const CUSTOMER_STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "error"> = {
  PROSPECT: "info", ACTIVE: "success", INACTIVE: "neutral", BLOCKED: "error",
};

export const CONTACT_CHANNEL_LABEL: Record<string, string> = {
  EMAIL: "Email", SMS: "SMS", CALL: "Gọi điện", ZALO: "Zalo", NONE: "Không liên hệ",
};
