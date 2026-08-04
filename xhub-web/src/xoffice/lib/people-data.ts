// People Essentials — PE-01 (Leave & Availability). Server-side data access
// (:4000, tenant-scoped). Reuses the XOffice tenant context. On backend down
// we degrade to empty with source='offline' (no fake data). Mirrors
// ./manage-data.ts exactly.
import { xofficeContext, type XOfficeContext } from "./workflow-data";

import { API_BASE_SERVER as API_BASE } from "@/lib/api-base";

export interface LeavePolicyRef {
  id: string;
  code: string;
  name: string;
  paid: boolean;
  unit: string;
  status: string;
  minNoticeDays: number;
  maxConsecutiveDays?: number | null;
}

export interface LeaveBalanceSnapshot {
  id: string;
  personId: string;
  leavePolicyId: string;
  periodCode: string;
  openingBalance: number;
  accrued: number;
  used: number;
  pending: number;
  adjusted: number;
  carriedOver: number;
  available: number;
  unit: string;
}

export interface LeaveRequest {
  id: string;
  personId: string;
  leaveTypeCode: string;
  leavePolicyId: string;
  startAt: string;
  endAt: string;
  startDayPart: string;
  endDayPart: string;
  durationValue: number;
  durationUnit: string;
  reason?: string | null;
  replacementPersonId?: string | null;
  status: string;
  submittedAt?: string | null;
  decidedAt?: string | null;
  decidedBy?: string | null;
  decisionNote?: string | null;
  cancelReason?: string | null;
  createdAt: string;
}

export interface LeaveImpactPreview {
  impactedWorkItemIds: string[];
  impactedMilestoneIds: string[];
  impactedApprovalTaskIds: string[];
  impactedBookingIds: string[];
  impactedDirectiveIds: string[];
  impactedProjectIds: string[];
  summary: { workItems: number; milestones: number; approvals: number; bookings: number; directives: number; riskLevel: "LOW" | "MEDIUM" | "HIGH" };
  capacityDeltaHours: number;
}

export interface TeamAvailabilityRoster {
  positionId: string;
  positionTitle: string;
  personId: string;
  fullName: string;
  leaves: LeaveRequest[];
}

async function get<T>(path: string, ctx: XOfficeContext): Promise<T | null> {
  const { data } = await getWithStatus<T>(path, ctx);
  return data;
}

/** Like `get`, but also surfaces the HTTP status so callers can tell a real
 * permission boundary (403 OUT_OF_SCOPE) apart from the backend actually
 * being down — collapsing both into "offline" would misreport an honest ABAC
 * denial as a network failure. */
async function getWithStatus<T>(path: string, ctx: XOfficeContext): Promise<{ data: T | null; status: number | null }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "x-tenant-id": ctx.tenantId, "x-user-id": ctx.userId, "content-type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { data: null, status: res.status };
    return { data: (await res.json()) as T, status: res.status };
  } catch {
    return { data: null, status: null };
  }
}

type Listed<T> = { items: T[]; count: number };

export async function listLeavePolicies() {
  const ctx = xofficeContext();
  const data = await get<Listed<LeavePolicyRef>>(`/api/people/leave-policies`, ctx);
  return { items: data?.items ?? [], source: (data ? "api" : "offline") as "api" | "offline" };
}

export async function myLeaveBalances(periodCode?: string) {
  const ctx = xofficeContext();
  const data = await get<{ items: { policy: LeavePolicyRef; balance: LeaveBalanceSnapshot }[]; periodCode: string }>(
    `/api/people/me/leave-balance${periodCode ? `?periodCode=${periodCode}` : ""}`,
    ctx,
  );
  return { items: data?.items ?? [], periodCode: data?.periodCode ?? "", source: (data ? "api" : "offline") as "api" | "offline" };
}

export async function listMyLeaveRequests(status?: string) {
  const ctx = xofficeContext();
  const data = await get<Listed<LeaveRequest>>(`/api/people/leave-requests${status ? `?status=${status}` : ""}`, ctx);
  return { items: data?.items ?? [], source: (data ? "api" : "offline") as "api" | "offline" };
}

export async function getLeaveRequest(id: string) {
  const ctx = xofficeContext();
  return get<LeaveRequest>(`/api/people/leave-requests/${id}`, ctx);
}

export async function teamAvailability(orgUnitId: string, from?: string, to?: string) {
  const ctx = xofficeContext();
  const qs = new URLSearchParams({ orgUnitId, ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
  const { data, status } = await getWithStatus<{ orgUnitId: string; from: string; to: string; roster: TeamAvailabilityRoster[]; count: number }>(
    `/api/people/team/availability?${qs}`,
    ctx,
  );
  return {
    roster: data?.roster ?? [],
    count: data?.count ?? 0,
    source: (data ? "api" : "offline") as "api" | "offline",
    forbidden: status === 403,
  };
}

export async function teamLeaveRequests(orgUnitId?: string, status?: string) {
  const ctx = xofficeContext();
  const qs = new URLSearchParams({ ...(orgUnitId ? { orgUnitId } : {}), ...(status ? { status } : {}) }).toString();
  const data = await get<Listed<LeaveRequest> & { scopedOrgUnits: string[] }>(`/api/people/team/leave-requests${qs ? `?${qs}` : ""}`, ctx);
  return { items: data?.items ?? [], scopedOrgUnits: data?.scopedOrgUnits ?? [], source: (data ? "api" : "offline") as "api" | "offline" };
}

// ---- PE-02 (Attendance & Correction) ---------------------------------------

export interface AttendanceDay {
  id: string;
  personId: string;
  workDate: string;
  firstIn?: string | null;
  lastOut?: string | null;
  workedMinutes: number;
  lateMinutes: number;
  status: string;
  correctionApplied: boolean;
}

export interface AttendanceCorrectionRequest {
  id: string;
  personId: string;
  workDate: string;
  reason: string;
  requestedStatus?: string | null;
  status: string;
  decisionNote?: string | null;
  createdAt: string;
}

export interface AttendanceImportBatch {
  id: string;
  fileName: string;
  templateVersion: string;
  checksum: string;
  status: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  preview: { row: number; personId: string; date: string; clockIn: string; clockOut: string; error?: string }[];
  createdAt: string;
  committedAt?: string | null;
  rolledBackAt?: string | null;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function myAttendance(from: Date, to: Date) {
  const ctx = xofficeContext();
  const qs = new URLSearchParams({ from: isoDate(from), to: isoDate(to) }).toString();
  const data = await get<Listed<AttendanceDay>>(`/api/people/attendance/me?${qs}`, ctx);
  return { items: data?.items ?? [], source: (data ? "api" : "offline") as "api" | "offline" };
}

export async function teamAttendance(orgUnitId: string, from: Date, to: Date) {
  const ctx = xofficeContext();
  const qs = new URLSearchParams({ orgUnitId, from: isoDate(from), to: isoDate(to) }).toString();
  const { data, status } = await getWithStatus<Listed<AttendanceDay>>(`/api/people/team/attendance?${qs}`, ctx);
  return { items: data?.items ?? [], source: (data ? "api" : "offline") as "api" | "offline", forbidden: status === 403 };
}

export async function myAttendanceCorrections() {
  const ctx = xofficeContext();
  const data = await get<Listed<AttendanceCorrectionRequest>>(`/api/people/attendance-corrections`, ctx);
  return { items: data?.items ?? [], source: (data ? "api" : "offline") as "api" | "offline" };
}

export async function listImportBatches() {
  const ctx = xofficeContext();
  const data = await get<Listed<AttendanceImportBatch>>(`/api/people/imports`, ctx);
  return { items: data?.items ?? [], source: (data ? "api" : "offline") as "api" | "offline" };
}
