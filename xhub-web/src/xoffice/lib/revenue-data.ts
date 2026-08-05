// Revenue & Contract MVP — server-side data access (:4001, tenant-scoped,
// Phase 2 BO-0202..0209). Mirrors customers-data.ts / announcements-data.ts.
import { xofficeContext, type XOfficeContext } from "./workflow-data";
import { XOFFICE_BASE_SERVER as API_BASE } from "@/lib/api-base";

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

// ---- Opportunity -------------------------------------------------------------

export interface OpportunityRow {
  id: string;
  customerId: string;
  title: string;
  stage: string;
  expectedAmount: string;
  currency: string;
  probability: number | null;
  expectedCloseDate: string | null;
  ownerIdentityId: string | null;
  lostReason: string | null;
  createdAt: string;
  customer?: { id: string; code: string; name: string };
}

export interface OpportunityDetail {
  opportunity: OpportunityRow;
  customer: { id: string; code: string; name: string } | null;
  proposals: ProposalRow[];
  contracts: ContractRow[];
  events: Array<{ id: string; type: string; actorId: string; createdAt: string; data: Record<string, unknown> }>;
}

export async function listOpportunities(filters: { stage?: string } = {}): Promise<{ items: OpportunityRow[]; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = xofficeContext();
  const qs = new URLSearchParams();
  if (filters.stage) qs.set("stage", filters.stage);
  const data = await get<OpportunityRow[]>(`/api/opportunities?${qs.toString()}`, ctx);
  return { items: Array.isArray(data) ? data : [], source: data ? "api" : "offline", ctx };
}

export async function getOpportunity(id: string): Promise<{ detail: OpportunityDetail | null; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = xofficeContext();
  const detail = await get<OpportunityDetail>(`/api/opportunities/${id}`, ctx);
  return { detail, source: detail ? "api" : "offline", ctx };
}

export const OPPORTUNITY_STAGE_LABEL: Record<string, string> = {
  LEAD: "Đầu mối", QUALIFIED: "Đã xác định", DISCOVERY: "Khảo sát", PROPOSAL: "Đề xuất",
  NEGOTIATION: "Đàm phán", WON: "Thắng", LOST: "Thua",
};

export const OPPORTUNITY_STAGE_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "error"> = {
  LEAD: "neutral", QUALIFIED: "info", DISCOVERY: "info", PROPOSAL: "warning",
  NEGOTIATION: "warning", WON: "success", LOST: "error",
};

// ---- Commercial Catalog --------------------------------------------------------

export interface CatalogItemRow {
  id: string;
  code: string;
  name: string;
  commercialType: string;
  priceModel: string | null;
  version: number;
  active: boolean;
}

export async function listCatalogItems(): Promise<{ items: CatalogItemRow[]; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = xofficeContext();
  const data = await get<CatalogItemRow[]>("/api/commercial-catalog", ctx);
  return { items: Array.isArray(data) ? data : [], source: data ? "api" : "offline", ctx };
}

// ---- Proposal -------------------------------------------------------------------

export interface ProposalLineRow {
  id: string;
  catalogItemId: string;
  quantity: number;
  unitPrice: string;
  discountPercent: number;
  lineTotal: string;
  catalogItem?: CatalogItemRow;
}

export interface ProposalRow {
  id: string;
  opportunityId: string;
  version: number;
  status: string;
  totalAmount: string;
  currency: string;
  requiresApproval: boolean;
  createdAt: string;
}

export interface ProposalDetail {
  proposal: ProposalRow;
  lines: ProposalLineRow[];
  events: Array<{ id: string; type: string; actorId: string; createdAt: string }>;
}

export async function getProposal(id: string): Promise<{ detail: ProposalDetail | null; ctx: XOfficeContext }> {
  const ctx = xofficeContext();
  const detail = await get<ProposalDetail>(`/api/proposals/${id}`, ctx);
  return { detail, ctx };
}

export const PROPOSAL_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp", IN_REVIEW: "Đang duyệt", APPROVED: "Đã duyệt", SENT: "Đã gửi",
  ACCEPTED: "Khách chấp nhận", REJECTED: "Từ chối", EXPIRED: "Hết hạn",
};

export const PROPOSAL_STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "error"> = {
  DRAFT: "neutral", IN_REVIEW: "warning", APPROVED: "info", SENT: "info",
  ACCEPTED: "success", REJECTED: "error", EXPIRED: "error",
};

// ---- Contract -------------------------------------------------------------------

export interface ContractLineRow {
  id: string;
  catalogItemId: string;
  deliveryMethod: string;
  billingMethod: string;
  lineValue: string;
  currency: string;
  acceptanceRequired: boolean;
  catalogItem?: CatalogItemRow;
}

export interface ContractSignatureRow {
  id: string;
  provider: string;
  envelopeRef: string;
  signedAt: string;
  signerName: string | null;
}

export interface ContractObligationRow {
  id: string;
  type: string;
  title: string;
  dueDate: string;
  billingPercent: number | null;
  status: string;
  alertStatus: string;
  evidenceRef: string | null;
  completedAt: string | null;
}

export interface BillingRequestRow {
  id: string;
  contractId: string;
  status: string;
  requestedAmount: string;
  currency: string;
  createdAt: string;
}

export interface ContractRow {
  id: string;
  contractNo: string;
  customerId: string;
  sourceOpportunityId: string | null;
  status: string;
  effectiveFrom: string | null;
  totalAmount: string;
  currency: string;
  createdAt: string;
  customer?: { id: string; code: string; name: string };
}

export interface ContractDetail {
  contract: ContractRow;
  lines: ContractLineRow[];
  signatures: ContractSignatureRow[];
  obligations: ContractObligationRow[];
  billingRequests: BillingRequestRow[];
  events: Array<{ id: string; type: string; actorId: string; createdAt: string; data: Record<string, unknown> }>;
}

export async function listContracts(filters: { status?: string } = {}): Promise<{ items: ContractRow[]; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = xofficeContext();
  const qs = new URLSearchParams();
  if (filters.status) qs.set("status", filters.status);
  const data = await get<ContractRow[]>(`/api/contracts?${qs.toString()}`, ctx);
  return { items: Array.isArray(data) ? data : [], source: data ? "api" : "offline", ctx };
}

export async function getContract(id: string): Promise<{ detail: ContractDetail | null; source: "api" | "offline"; ctx: XOfficeContext }> {
  const ctx = xofficeContext();
  const detail = await get<ContractDetail>(`/api/contracts/${id}`, ctx);
  return { detail, source: detail ? "api" : "offline", ctx };
}

export const CONTRACT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp", REVIEW: "Đang xem xét", NEGOTIATION: "Đàm phán", APPROVED: "Đã duyệt",
  SIGNING: "Đang ký", EFFECTIVE: "Đang hiệu lực", SUSPENDED: "Tạm dừng",
  EXPIRED: "Hết hạn", TERMINATED: "Chấm dứt", COMPLETED: "Hoàn thành",
};

export const CONTRACT_STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "error"> = {
  DRAFT: "neutral", REVIEW: "info", NEGOTIATION: "warning", APPROVED: "info",
  SIGNING: "warning", EFFECTIVE: "success", SUSPENDED: "warning",
  EXPIRED: "error", TERMINATED: "error", COMPLETED: "success",
};

export const OBLIGATION_ALERT_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "error"> = {
  PENDING: "neutral", DUE_SOON: "warning", OVERDUE: "error", COMPLETED: "success", WAIVED: "neutral",
};

// ---- Revenue KPI ------------------------------------------------------------------

export interface RevenueKpiRow {
  code: string;
  name: string;
  value: number | null;
  formula: string;
  source: string;
  unavailable?: boolean;
  note?: string;
}

export async function getRevenueKpis(): Promise<{ asOf: string | null; currency: string; kpis: RevenueKpiRow[]; source: "api" | "offline" }> {
  const ctx = xofficeContext();
  const data = await get<{ asOf: string; currency: string; kpis: RevenueKpiRow[] }>("/api/revenue-kpi", ctx);
  return { asOf: data?.asOf ?? null, currency: data?.currency ?? "VND", kpis: data?.kpis ?? [], source: data ? "api" : "offline" };
}

export function formatMoney(amount: string | number, currency: string): string {
  const n = Number(amount);
  return `${n.toLocaleString("vi-VN")} ${currency}`;
}
