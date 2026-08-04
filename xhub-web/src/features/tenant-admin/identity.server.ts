// Server-side BFF client for the Identity/Org Core module (/api/identity).
// Resilient (mirrors backup.server.ts): every function returns { source } +
// mapped data. On any non-OK / empty / thrown response it degrades to the demo
// dataset from data.ts so the screen renders instead of crashing. The FE never
// touches the DB — always via the API base the rest of the app uses.
import "server-only";
import {
  ORG_UNITS, POSITIONS, getAdminUsers,
  type OrgUnit, type Position, type AdminUser, type ExternalIdentity,
} from "./data";

import { API_BASE_SERVER as API } from "@/lib/api-base";
// Canonical admin session identity for server-side fetches (soft IdentityGuard),
// same convention as backup.server.ts / inbox page.tsx.
const HEADERS = { "x-tenant-id": "tenant-xtech", "x-user-id": "user-nam" } as const;

export type Source = "live" | "demo";

// ---- raw live shapes ------------------------------------------------------
interface LiveOrgUnit { id: string; code: string; name: string; type: string; parentId: string | null; children?: LiveOrgUnit[] }
interface LivePosition { id: string; code: string; title: string; orgUnitId: string; holderPersonId: string | null; reportsToPositionId: string | null; isHead: boolean }
interface LivePerson { id: string; fullName: string; email: string | null; phone?: string | null; avatarUrl?: string | null; status: string; externalIdRefs?: { userId?: string | null } | null }
export interface RoleBinding { id: string; subjectType: "USER" | "POSITION" | "GROUP"; subjectId: string; roleCode: string; scope: Record<string, unknown> }
export interface Group { id: string; code: string; name: string; memberPersonIds: string[] }

/** Prettify a live role code (ROLE_SALES_MANAGER → "Sales Manager"). */
function roleLabel(code: string): string {
  return code.replace(/^ROLE_/, "").toLowerCase().split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { headers: HEADERS, cache: "no-store" });
    if (!res.ok) return null;
    const rows = (await res.json()) as T;
    return rows;
  } catch {
    return null;
  }
}

function flattenTree(nodes: LiveOrgUnit[], acc: LiveOrgUnit[] = []): LiveOrgUnit[] {
  for (const n of nodes) {
    acc.push(n);
    if (n.children?.length) flattenTree(n.children, acc);
  }
  return acc;
}

// ---- combined org structure (units + positions) --------------------------
export interface OrgStructure { source: Source; units: OrgUnit[]; positions: Position[]; people: { id: string; name: string }[] }

/**
 * Live org units + positions, mapped into the demo OrgUnit/Position shapes so
 * the existing client components need no change. On any failure both fall back
 * to the demo catalog together (they must stay internally consistent).
 */
export async function getOrgStructure(): Promise<OrgStructure> {
  const [treeRaw, posRaw, peopleRaw] = await Promise.all([
    get<LiveOrgUnit[]>("/api/identity/org-units"),
    get<LivePosition[]>("/api/identity/positions"),
    get<LivePerson[]>("/api/identity/people"),
  ]);
  if (!Array.isArray(treeRaw) || treeRaw.length === 0 || !Array.isArray(posRaw)) {
    const people = [...new Set(POSITIONS.map((p) => p.person).filter(Boolean))].map((n) => ({ id: n, name: n }));
    return { source: "demo", units: ORG_UNITS, positions: POSITIONS, people };
  }
  const flat = flattenTree(treeRaw);
  const idToCode = new Map(flat.map((u) => [u.id, u.code]));
  const headByUnitId = new Map<string, string>();
  for (const p of posRaw) if (p.isHead) headByUnitId.set(p.orgUnitId, p.code);
  const personName = new Map<string, string>((peopleRaw ?? []).map((p) => [p.id, p.fullName]));

  const units: OrgUnit[] = flat.map((u) => ({
    code: u.code,
    name: u.name,
    type: u.type,
    parent: u.parentId ? idToCode.get(u.parentId) ?? null : null,
    headPosition: headByUnitId.get(u.id) ?? null,
  }));

  const positions: Position[] = posRaw.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.title,
    orgUnit: idToCode.get(p.orgUnitId) ?? p.orgUnitId,
    holder: p.holderPersonId ?? "",
    holderId: p.holderPersonId ?? "",
    person: p.holderPersonId ? personName.get(p.holderPersonId) ?? p.holderPersonId : "",
  }));
  const people = (peopleRaw ?? []).map((p) => ({ id: p.id, name: p.fullName }));
  return { source: "live", units, positions, people };
}

// ---- id-based org graph (for the visual chart + drag-and-drop) -----------
// The demo OrgUnit/Position shapes are code-keyed; the drag-and-drop chart needs
// stable ids to PATCH. getOrgGraph() exposes id + real parentId (ids), keeping
// getOrgStructure() untouched for the existing StatCards/AI panel consumers.
export interface OrgGraphNode {
  id: string; code: string; name: string; type: string; parentId: string | null;
  headName: string | null; headTitle: string | null; positionCount: number; staffCount: number;
}
export interface OrgGraphPosition {
  id: string; name: string; orgUnitId: string;
  holderName: string | null; holderId: string | null;
  holderEmail: string | null; holderPhone: string | null; holderAvatarUrl: string | null;
  reportsToPositionId: string | null; isHead: boolean;
}
export interface OrgGraph { source: Source; nodes: OrgGraphNode[]; positions: OrgGraphPosition[] }

/** Live org graph with ids (drives OrgChart). Falls back to a demo graph
 *  synthesised from ORG_UNITS/POSITIONS (id := code) so the chart still renders. */
export async function getOrgGraph(): Promise<OrgGraph> {
  const [treeRaw, posRaw, peopleRaw] = await Promise.all([
    get<LiveOrgUnit[]>("/api/identity/org-units"),
    get<LivePosition[]>("/api/identity/positions"),
    get<LivePerson[]>("/api/identity/people"),
  ]);

  if (!Array.isArray(treeRaw) || treeRaw.length === 0 || !Array.isArray(posRaw)) {
    // Demo fallback: code stands in for id; parent(code) → parentId(code).
    const nodes: OrgGraphNode[] = ORG_UNITS.map((u) => {
      const inUnit = POSITIONS.filter((p) => p.orgUnit === u.code);
      const head = POSITIONS.find((p) => p.code === u.headPosition);
      return {
        id: u.code, code: u.code, name: u.name, type: u.type, parentId: u.parent,
        headName: head?.person ?? null, headTitle: head?.name ?? null, positionCount: inUnit.length,
        staffCount: inUnit.filter((p) => p.holder).length,
      };
    });
    const positions: OrgGraphPosition[] = POSITIONS.map((p) => ({
      id: p.code, name: p.name, orgUnitId: p.orgUnit, holderName: p.person || null,
      holderId: p.holderId || null, holderEmail: null, holderPhone: null, holderAvatarUrl: null,
      reportsToPositionId: null, isHead: false,
    }));
    return { source: "demo", nodes, positions };
  }

  const flat = flattenTree(treeRaw);
  const personName = new Map<string, string>((peopleRaw ?? []).map((p) => [p.id, p.fullName]));
  const personById = new Map<string, LivePerson>((peopleRaw ?? []).map((p) => [p.id, p]));
  const headByUnitId = new Map<string, LivePosition>();
  for (const p of posRaw) if (p.isHead) headByUnitId.set(p.orgUnitId, p);

  const nodes: OrgGraphNode[] = flat.map((u) => {
    const inUnit = posRaw.filter((p) => p.orgUnitId === u.id);
    const head = headByUnitId.get(u.id);
    return {
      id: u.id, code: u.code, name: u.name, type: u.type, parentId: u.parentId ?? null,
      headName: head?.holderPersonId ? personName.get(head.holderPersonId) ?? null : null,
      headTitle: head?.title ?? null,
      positionCount: inUnit.length,
      staffCount: inUnit.filter((p) => p.holderPersonId).length,
    };
  });
  const positions: OrgGraphPosition[] = posRaw.map((p) => {
    const holder = p.holderPersonId ? personById.get(p.holderPersonId) : undefined;
    return {
      id: p.id, name: p.title, orgUnitId: p.orgUnitId,
      holderName: p.holderPersonId ? personName.get(p.holderPersonId) ?? p.holderPersonId : null,
      holderId: p.holderPersonId ?? null,
      holderEmail: holder?.email ?? null,
      holderPhone: holder?.phone ?? null,
      holderAvatarUrl: holder?.avatarUrl ?? null,
      reportsToPositionId: p.reportsToPositionId ?? null,
      isHead: !!p.isHead,
    };
  });
  return { source: "live", nodes, positions };
}

/** Org units only (falls back to ORG_UNITS). */
export async function getOrgUnits(): Promise<{ source: Source; units: OrgUnit[] }> {
  const { source, units } = await getOrgStructure();
  return { source, units };
}

/** Positions with holder person names resolved (falls back to POSITIONS). */
export async function getPositions(): Promise<{ source: Source; positions: Position[] }> {
  const { source, positions } = await getOrgStructure();
  return { source, positions };
}

// ---- people → AdminUser[] -------------------------------------------------
/**
 * Live people composed with positions + groups + role-bindings into AdminUser[]
 * (role names/codes, department, title). Falls back to the seed-derived
 * getAdminUsers() on any failure.
 */
export async function getPeople(): Promise<{ source: Source; users: AdminUser[] }> {
  const [peopleRaw, structure, groupsRaw, bindingsRaw, unitsRes] = await Promise.all([
    get<LivePerson[]>("/api/identity/people"),
    // positions raw needed with ids → refetch raw (structure loses ids)
    get<LivePosition[]>("/api/identity/positions"),
    get<Group[]>("/api/identity/groups"),
    get<RoleBinding[]>("/api/identity/role-bindings"),
    get<LiveOrgUnit[]>("/api/identity/org-units"),
  ]);
  if (!Array.isArray(peopleRaw) || peopleRaw.length === 0 || !Array.isArray(structure) || !Array.isArray(bindingsRaw)) {
    return { source: "demo", users: getAdminUsers() };
  }
  const flatUnits = flattenTree(unitsRes ?? []);
  const unitNameById = new Map(flatUnits.map((u) => [u.id, u.name]));
  const positions = structure;
  const groups = groupsRaw ?? [];
  const bindings = bindingsRaw;

  const users: AdminUser[] = peopleRaw.map((person) => {
    const held = positions.filter((p) => p.holderPersonId === person.id);
    const heldIds = new Set(held.map((p) => p.id));
    const memberGroupIds = new Set(groups.filter((g) => g.memberPersonIds.includes(person.id)).map((g) => g.id));
    const codes: string[] = [];
    for (const b of bindings) {
      if (b.subjectType === "USER" && b.subjectId === person.id) codes.push(b.roleCode);
      else if (b.subjectType === "POSITION" && heldIds.has(b.subjectId)) codes.push(b.roleCode);
      else if (b.subjectType === "GROUP" && memberGroupIds.has(b.subjectId)) codes.push(b.roleCode);
    }
    const roleCodes = [...new Set(codes)];
    const headPos = held[0];
    const ext: ExternalIdentity[] = [
      { provider: "Azure AD (X-TECH)", subject: person.email ?? person.id, mfa: true },
    ];
    return {
      id: person.id,
      name: person.fullName,
      email: person.email ?? "—",
      title: headPos?.title ?? "—",
      department: headPos ? unitNameById.get(headPos.orgUnitId) ?? "—" : "—",
      departmentId: headPos?.orgUnitId,
      status: (person.status as AdminUser["status"]) ?? "active",
      presence: "offline",
      roleNames: roleCodes.map(roleLabel),
      roleCodes,
      externalIdentities: ext,
    } satisfies AdminUser;
  });
  return { source: "live", users };
}

/** Role bindings (raw live). Falls back to empty demo set with source flag. */
export async function getRoleBindings(): Promise<{ source: Source; bindings: RoleBinding[] }> {
  const rows = await get<RoleBinding[]>("/api/identity/role-bindings");
  if (!Array.isArray(rows) || rows.length === 0) return { source: "demo", bindings: [] };
  return { source: "live", bindings: rows };
}

// ---- delegations ----------------------------------------------------------
import { DELEGATIONS, type Delegation } from "./data";

interface LiveDelegation { id: string; fromUserId: string; toUserId: string; fromAt: string; toAt: string; reason: string | null }

/** Classify a delegation window against "now" → active | scheduled | expired. */
function delegationStatus(fromAt: string, toAt: string): Delegation["status"] {
  const now = Date.now();
  const f = new Date(fromAt).getTime();
  const t = new Date(toAt).getTime();
  if (now < f) return "scheduled";
  if (now > t) return "expired";
  return "active";
}

/**
 * Live delegations (raw), mapped into the demo Delegation shape so the client
 * renders unchanged. Resolves user ids → person names when available. Falls back
 * to the demo DELEGATIONS dataset on any failure.
 */
export async function getDelegations(): Promise<{ source: Source; delegations: Delegation[] }> {
  const [rows, peopleRaw] = await Promise.all([
    get<LiveDelegation[]>("/api/identity/delegations"),
    get<LivePerson[]>("/api/identity/people"),
  ]);
  if (!Array.isArray(rows) || rows.length === 0) return { source: "demo", delegations: DELEGATIONS };
  const nameFor = (uid: string) => {
    const byId = (peopleRaw ?? []).find((p) => p.id === uid);
    const byExt = (peopleRaw ?? []).find((p) => p.externalIdRefs?.userId === uid);
    return byId?.fullName ?? byExt?.fullName ?? uid;
  };
  const delegations: Delegation[] = rows.map((d) => ({
    id: d.id,
    fromPerson: nameFor(d.fromUserId),
    toPerson: nameFor(d.toUserId),
    scope: "Uỷ quyền phê duyệt",
    fromAt: d.fromAt,
    toAt: d.toAt,
    status: delegationStatus(d.fromAt, d.toAt),
    reason: d.reason ?? "—",
  }));
  return { source: "live", delegations };
}

// ---- workflow selectors (for the assignment-resolver live preview) --------
export interface WorkflowSelector { code: string; name: string; nodes: { id: string; name: string; type: string }[] }

interface LiveWorkflowSummary { code: string; name: string }
interface LiveWorkflowDetail { nodes?: { id: string; name: string; type: string }[] }

/**
 * Workflows + their assignable (approval/humanTask) nodes, for the "who will
 * approve" live preview. Fetches the xoffice workflow catalog then each detail.
 * Returns [] on any failure so the screen keeps its demo simulator.
 */
export async function getWorkflowSelectors(): Promise<{ source: Source; workflows: WorkflowSelector[] }> {
  const list = await get<LiveWorkflowSummary[]>("/api/xoffice/workflows");
  if (!Array.isArray(list) || list.length === 0) return { source: "demo", workflows: [] };
  const details = await Promise.all(
    list.map(async (w) => {
      const d = await get<LiveWorkflowDetail>(`/api/xoffice/workflows/${w.code}`);
      const nodes = (d?.nodes ?? []).filter((n) => n.type === "approval" || n.type === "humanTask");
      return { code: w.code, name: w.name, nodes } satisfies WorkflowSelector;
    }),
  );
  const workflows = details.filter((w) => w.nodes.length > 0);
  return { source: workflows.length ? "live" : "demo", workflows };
}

/** Groups (raw live). */
export async function getGroups(): Promise<{ source: Source; groups: Group[] }> {
  const rows = await get<Group[]>("/api/identity/groups");
  if (!Array.isArray(rows) || rows.length === 0) return { source: "demo", groups: [] };
  return { source: "live", groups: rows };
}
