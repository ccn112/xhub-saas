// Server-side BFF client for the Records / Documents module (/api/records, Mục 8a).
// Resilient: if the backend is down (or empty) we degrade to a small DEMO set
// derived from the seed "documents" collection, with a clear source flag so the
// screen still renders. FE never touches the DB — always via XHUB_API_URL.
import "server-only";
import { collection } from "@/xhub/lib/seed";

const API = process.env.XHUB_API_URL || "http://localhost:4000";
const HEADERS = { "x-tenant-id": "tenant-xtech", "x-user-id": "user-nam" } as const;

export type Source = "live" | "demo";

// ---- view models -----------------------------------------------------------
export interface DocumentView {
  id: string;
  title: string;
  kind: string;
  tags: string[];
  currentVersionId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  createdAt: string;
  updatedAt?: string;
  /** Number of immutable versions; current-version byte size (from list endpoint). */
  versionCount?: number;
  byteSize?: number;
}

export interface VersionView {
  id: string;
  versionNo: number;
  contentHash: string;
  byteSize: number;
  mimeType: string;
  createdBy?: string | null;
  createdAt: string;
}

export interface DocumentDetailView {
  document: DocumentView;
  versions: VersionView[];
}

export interface DocumentsListResult {
  source: Source;
  documents: DocumentView[];
  /** Total versions across the list (live: summed from per-doc versionCount). */
  versionCount: number;
  byteSize: number;
}

export interface DocumentFilter { kind?: string; subjectType?: string; subjectId?: string }

// ---- API shapes ------------------------------------------------------------
interface ApiDoc {
  id: string; title: string; kind?: string; tags?: string[];
  currentVersionId?: string | null; subjectType?: string | null; subjectId?: string | null;
  createdAt: string; updatedAt?: string;
  // Enriched by the list endpoint (records.service.listDocuments).
  byteSize?: number; versionCount?: number;
  currentVersion?: { versionNo: number; byteSize: number; mimeType: string } | null;
}
interface ApiVersion {
  id: string; versionNo: number; contentHash: string; byteSize: number;
  mimeType: string; createdBy?: string | null; createdAt: string;
}

function normalizeDoc(d: ApiDoc): DocumentView {
  return {
    id: d.id,
    title: d.title,
    kind: d.kind ?? "GENERIC",
    tags: Array.isArray(d.tags) ? d.tags : [],
    currentVersionId: d.currentVersionId ?? null,
    subjectType: d.subjectType ?? null,
    subjectId: d.subjectId ?? null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    versionCount: d.versionCount ?? 1,
    byteSize: d.byteSize ?? d.currentVersion?.byteSize ?? 0,
  };
}

function normalizeVersion(v: ApiVersion): VersionView {
  return {
    id: v.id,
    versionNo: v.versionNo,
    contentHash: v.contentHash,
    byteSize: v.byteSize,
    mimeType: v.mimeType,
    createdBy: v.createdBy ?? null,
    createdAt: v.createdAt,
  };
}

// ---- demo fallback (derived from the seed "documents" collection) ----------
interface SeedDoc {
  id: string; title: string; fileName?: string; type: string; size?: number;
  uploadedBy: string; updatedAt: string; projectId?: string; customerId?: string; version?: string;
}

const KIND_BY_TYPE: Record<string, string> = {
  pdf: "PROPOSAL", pptx: "PROPOSAL", xlsx: "QUOTE", docx: "TECH_DOC",
};

function demoData(): DocumentsListResult {
  const seed = collection<SeedDoc>("documents");
  const documents: DocumentView[] = seed.map((d) => ({
    id: d.id,
    title: d.title,
    kind: KIND_BY_TYPE[d.type] ?? "GENERIC",
    tags: [d.type, ...(d.projectId ? ["du-an"] : []), ...(d.customerId ? ["khach-hang"] : [])],
    currentVersionId: `${d.id}-v1`,
    subjectType: d.projectId ? "Project" : d.customerId ? "Customer" : null,
    subjectId: d.projectId ?? d.customerId ?? null,
    createdAt: d.updatedAt,
    updatedAt: d.updatedAt,
  }));
  const byteSize = seed.reduce((s, d) => s + (d.size ?? 0), 0);
  return { source: "demo", documents, versionCount: documents.length, byteSize };
}

function demoDetail(id: string): { source: Source; detail: DocumentDetailView | null } {
  const { documents } = demoData();
  const doc = documents.find((d) => d.id === id);
  if (!doc) return { source: "demo", detail: null };
  const seed = collection<SeedDoc>("documents").find((d) => d.id === id);
  const versions: VersionView[] = [
    {
      id: `${id}-v1`,
      versionNo: 1,
      contentHash: "demo".padEnd(64, "0"),
      byteSize: seed?.size ?? 0,
      mimeType: "application/octet-stream",
      createdBy: seed?.uploadedBy ?? null,
      createdAt: doc.createdAt,
    },
  ];
  return { source: "demo", detail: { document: doc, versions } };
}

// ---- reads -----------------------------------------------------------------
/** GET /api/records — list documents. Falls back to demo on any failure/empty. */
export async function fetchDocuments(filter?: DocumentFilter): Promise<DocumentsListResult> {
  try {
    const qs = new URLSearchParams();
    if (filter?.kind) qs.set("kind", filter.kind);
    if (filter?.subjectType) qs.set("subjectType", filter.subjectType);
    if (filter?.subjectId) qs.set("subjectId", filter.subjectId);
    const suffix = qs.toString() ? `?${qs}` : "";
    const res = await fetch(`${API}/api/records${suffix}`, { headers: HEADERS, cache: "no-store" });
    if (!res.ok) return demoData();
    const rows = (await res.json()) as ApiDoc[];
    if (!Array.isArray(rows) || rows.length === 0) return demoData();
    const documents = rows.map(normalizeDoc);
    // List endpoint now carries versionCount + current-version byteSize per doc,
    // so both aggregate stats are accurate without per-doc detail round-trips.
    const versionCount = documents.reduce((s, d) => s + (d.versionCount ?? 1), 0);
    const byteSize = documents.reduce((s, d) => s + (d.byteSize ?? 0), 0);
    return { source: "live", documents, versionCount, byteSize };
  } catch {
    return demoData();
  }
}

/** GET /api/records/:id — document + version history. Falls back to demo. */
export async function fetchDocument(id: string): Promise<{ source: Source; detail: DocumentDetailView | null }> {
  try {
    const res = await fetch(`${API}/api/records/${id}`, { headers: HEADERS, cache: "no-store" });
    if (!res.ok) return demoDetail(id);
    const body = (await res.json()) as { document: ApiDoc; versions: ApiVersion[] };
    if (!body?.document) return demoDetail(id);
    return {
      source: "live",
      detail: {
        document: normalizeDoc(body.document),
        versions: (Array.isArray(body.versions) ? body.versions : []).map(normalizeVersion),
      },
    };
  } catch {
    return demoDetail(id);
  }
}
