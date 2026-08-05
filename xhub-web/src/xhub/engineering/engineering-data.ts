// Engineering Governance (DG-01) — server-side data access (:4000, platform
// plane). Reads the SHARED Product/ProductVersion registry via the platform
// API. Degrades gracefully to an empty result with source='offline' (dev
// only) — never demo/fake data. Mirrors src/xhub/platform/platform-data.ts.
import { PLATFORM_BASE_SERVER as API_BASE } from "@/lib/api-base";

const HEADERS = { "content-type": "application/json", "x-tenant-id": "tenant-xtech", "x-user-id": "user-nam" } as const;

export interface ProductComponentRow {
  id: string;
  code: string;
  name: string | null;
  type: string;
  repositories: Array<{ id: string; provider: string; repoFullName: string | null; defaultBranch: string; connectorStatus: string }>;
}

export interface EnvironmentRow {
  id: string;
  name: string;
  label: string | null;
}

export interface ProductVersionRow {
  id: string;
  productId: string;
  version: string;
  status: string;
  releaseChannel: string | null;
  releasedAt: string | null;
  createdAt: string;
}

export interface ProductRow {
  id: string;
  code: string;
  name: string;
  type: string;
  ownerRole: string | null;
  versionPolicy: string;
  description: string | null;
  rolloutOrder: number | null;
  components?: ProductComponentRow[];
  environments?: EnvironmentRow[];
  versions?: ProductVersionRow[];
}

export type Source = "api" | "offline";

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers: HEADERS, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function listProducts(): Promise<{ items: ProductRow[]; source: Source }> {
  const data = await get<ProductRow[]>("/api/engineering/products");
  return { items: Array.isArray(data) ? data : [], source: data ? "api" : "offline" };
}

export async function getProduct(idOrCode: string): Promise<{ product: ProductRow | null; source: Source }> {
  const data = await get<ProductRow>(`/api/engineering/products/${encodeURIComponent(idOrCode)}`);
  return { product: data ?? null, source: data ? "api" : "offline" };
}

/** All versions across all products, newest first — used by the /engineering/versions cross-product view. */
export async function listAllVersions(): Promise<{ items: Array<ProductVersionRow & { productCode: string; productName: string }>; source: Source }> {
  const { items: products, source } = await listProducts();
  if (source === "offline") return { items: [], source };
  const withDetail = await Promise.all(products.map((p) => getProduct(p.code)));
  const rows = withDetail.flatMap(({ product }) =>
    (product?.versions ?? []).map((v) => ({ ...v, productCode: product!.code, productName: product!.name })),
  );
  rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return { items: rows, source: "api" };
}

export const VERSION_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  PLANNING: "Lập kế hoạch",
  IN_DEVELOPMENT: "Đang phát triển",
  CODE_FREEZE: "Khoá mã",
  UAT: "UAT",
  RELEASE_CANDIDATE: "Ứng viên phát hành",
  RELEASED: "Đã phát hành",
  DEPRECATED: "Ngừng khuyến nghị",
  END_OF_LIFE: "Ngừng hỗ trợ",
};

export const VERSION_STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "error"> = {
  DRAFT: "neutral",
  PLANNING: "neutral",
  IN_DEVELOPMENT: "info",
  CODE_FREEZE: "warning",
  UAT: "warning",
  RELEASE_CANDIDATE: "warning",
  RELEASED: "success",
  DEPRECATED: "error",
  END_OF_LIFE: "error",
};

export const PRODUCT_TYPE_LABEL: Record<string, string> = {
  PLATFORM: "Nền tảng",
  SAAS_PRODUCT: "Sản phẩm SaaS",
  DOMAIN_PRODUCT: "Sản phẩm chuyên ngành",
};

// ---- DG-02 Backlog/Feature -------------------------------------------------

export interface BacklogItemRow {
  id: string;
  productId: string;
  featureId: string | null;
  code: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  targetVersionId: string | null;
  createdAt: string;
}

export interface FeatureRow {
  id: string;
  productId: string;
  code: string;
  title: string;
  description: string | null;
  status: string;
  targetVersionId: string | null;
  backlogItems?: BacklogItemRow[];
}

export async function listFeatures(productId: string): Promise<{ items: FeatureRow[]; source: Source }> {
  const data = await get<FeatureRow[]>(`/api/engineering/features?productId=${encodeURIComponent(productId)}`);
  return { items: Array.isArray(data) ? data : [], source: data ? "api" : "offline" };
}

export async function listBacklog(productId: string, status?: string): Promise<{ items: BacklogItemRow[]; source: Source }> {
  const qs = status ? `&status=${encodeURIComponent(status)}` : "";
  const data = await get<BacklogItemRow[]>(`/api/engineering/backlog?productId=${encodeURIComponent(productId)}${qs}`);
  return { items: Array.isArray(data) ? data : [], source: data ? "api" : "offline" };
}

export const BACKLOG_STATUS_LABEL: Record<string, string> = {
  IDEA: "Ý tưởng", TRIAGED: "Đã phân loại", READY: "Sẵn sàng", IN_PROGRESS: "Đang làm",
  IN_REVIEW: "Đang review", READY_FOR_TEST: "Chờ kiểm thử", TESTING: "Đang kiểm thử",
  ACCEPTED: "Đã chấp nhận", RELEASED: "Đã phát hành", BLOCKED: "Bị chặn", REJECTED: "Từ chối",
  DUPLICATE: "Trùng lặp", DEFERRED: "Hoãn lại", CANCELLED: "Đã huỷ",
};

export const BACKLOG_STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "error"> = {
  IDEA: "neutral", TRIAGED: "neutral", READY: "info", IN_PROGRESS: "info", IN_REVIEW: "warning",
  READY_FOR_TEST: "warning", TESTING: "warning", ACCEPTED: "success", RELEASED: "success",
  BLOCKED: "error", REJECTED: "error", DUPLICATE: "error", DEFERRED: "neutral", CANCELLED: "error",
};

export const BACKLOG_TYPE_LABEL: Record<string, string> = {
  FEATURE: "Tính năng", STORY: "Story", TASK: "Việc", DEFECT: "Lỗi", SECURITY_FINDING: "Phát hiện bảo mật",
  TECH_DEBT: "Nợ kỹ thuật", DOCUMENTATION: "Tài liệu", TEST_GAP: "Thiếu kiểm thử",
  UPGRADE_MIGRATION: "Nâng cấp/Migration", COMPLIANCE_ACTION: "Hành động tuân thủ",
};

// ---- DG-03-lite Documents ---------------------------------------------------

export interface DocumentRow {
  id: string;
  productId: string;
  code: string;
  title: string;
  documentType: string;
  status: string;
  classification: string;
  body: string | null;
  version: number;
  standardsRefs: string[];
  updatedAt: string;
}

export async function listDocuments(productId: string): Promise<{ items: DocumentRow[]; source: Source }> {
  const data = await get<DocumentRow[]>(`/api/engineering/documents?productId=${encodeURIComponent(productId)}`);
  return { items: Array.isArray(data) ? data : [], source: data ? "api" : "offline" };
}

export async function getDocument(idOrCode: string): Promise<{ document: DocumentRow | null; source: Source }> {
  const data = await get<DocumentRow>(`/api/engineering/documents/${encodeURIComponent(idOrCode)}`);
  return { document: data ?? null, source: data ? "api" : "offline" };
}

export const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  ARCHITECTURE: "Kiến trúc", DOMAIN_SOR: "Domain & SoR", API_EVENT: "API & Event",
  DATA_MIGRATION: "Dữ liệu & Migration", SECURITY_PRIVACY: "Bảo mật & Riêng tư",
  DEV_GUIDE: "Hướng dẫn phát triển", TEST_ACCEPTANCE: "Kiểm thử & Nghiệm thu",
  OPERATIONS_RUNBOOK: "Vận hành", USER_GUIDE: "Hướng dẫn sử dụng", TRAINING: "Đào tạo",
  RELEASE_NOTES: "Ghi chú phát hành", UPGRADE_ROLLBACK: "Nâng cấp/Rollback", OTHER: "Khác",
};

export const DOC_STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "error"> = {
  DRAFT: "neutral", REVIEW: "warning", APPROVED: "info", PUBLISHED: "success", DEPRECATED: "error", ARCHIVED: "neutral",
};

// ---- DG-04-lite Test hierarchy ---------------------------------------------

export interface TestSuiteRow {
  id: string;
  productId: string;
  name: string;
  _count?: { cases: number };
}

export interface TestCaseRow {
  id: string;
  testSuiteId: string;
  code: string;
  title: string;
  expectedResult: string | null;
  deepLinkTemplate: string | null;
  externalLegacyCode: string | null;
  level: string;
  requiredForRelease: boolean;
  standardsRefs: string[];
  currentStatus: string;
  lastResult: { id: string; status: string; actualResult: string | null; notes: string | null; testedAt: string; testerUserId: string | null } | null;
  defect: { id: string; code: string; status: string } | null;
}

export async function listTestSuites(productId: string): Promise<{ items: TestSuiteRow[]; source: Source }> {
  const data = await get<TestSuiteRow[]>(`/api/engineering/test-suites?productId=${encodeURIComponent(productId)}`);
  return { items: Array.isArray(data) ? data : [], source: data ? "api" : "offline" };
}

export async function listTestCases(
  testSuiteId: string,
  opts: { productVersionId?: string; status?: string } = {},
): Promise<{ items: TestCaseRow[]; source: Source }> {
  const params = new URLSearchParams({ testSuiteId });
  if (opts.productVersionId) params.set("productVersionId", opts.productVersionId);
  if (opts.status) params.set("status", opts.status);
  const data = await get<TestCaseRow[]>(`/api/engineering/test-cases?${params.toString()}`);
  return { items: Array.isArray(data) ? data : [], source: data ? "api" : "offline" };
}

export const TEST_RESULT_STATUS_LABEL: Record<string, string> = {
  NOT_RUN: "Chưa test", PASS: "Đạt", FAIL: "Không đạt", BLOCKED: "Bị chặn",
  NOT_APPLICABLE: "Không áp dụng", NEEDS_CLARIFICATION: "Cần làm rõ",
};

export const TEST_RESULT_STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "error"> = {
  NOT_RUN: "neutral", PASS: "success", FAIL: "error", BLOCKED: "warning",
  NOT_APPLICABLE: "neutral", NEEDS_CLARIFICATION: "warning",
};

// ---- DG-05 Defects -----------------------------------------------------------

export interface DefectRow {
  id: string;
  productId: string;
  productVersionId: string | null;
  testCaseId: string | null;
  testResultId: string | null;
  code: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  rootCause: string | null;
  standardsRefs: string[];
  createdAt: string;
  updatedAt: string;
}

export async function listDefects(productId: string, opts: { status?: string; severity?: string } = {}): Promise<{ items: DefectRow[]; source: Source }> {
  const params = new URLSearchParams({ productId });
  if (opts.status) params.set("status", opts.status);
  if (opts.severity) params.set("severity", opts.severity);
  const data = await get<DefectRow[]>(`/api/engineering/defects?${params.toString()}`);
  return { items: Array.isArray(data) ? data : [], source: data ? "api" : "offline" };
}

export const DEFECT_STATUS_LABEL: Record<string, string> = {
  NEW: "Mới", TRIAGED: "Đã phân loại", IN_PROGRESS: "Đang xử lý", FIX_READY: "Đã có bản vá",
  VERIFYING: "Đang xác nhận", CLOSED: "Đã đóng", WONT_FIX: "Không sửa", DUPLICATE: "Trùng lặp", REOPENED: "Mở lại",
};

export const DEFECT_STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "error"> = {
  NEW: "error", TRIAGED: "warning", IN_PROGRESS: "warning", FIX_READY: "info",
  VERIFYING: "info", CLOSED: "success", WONT_FIX: "neutral", DUPLICATE: "neutral", REOPENED: "error",
};

export const DEFECT_SEVERITY_LABEL: Record<string, string> = {
  P0: "P0 — Nghiêm trọng", P1: "P1 — Cao", P2: "P2 — Trung bình", P3: "P3 — Thấp",
};

// ---- DG-06 CI/Build ----------------------------------------------------------

export interface BuildRecordRow {
  id: string;
  productId: string;
  source: string;
  externalId: string;
  commitSha: string;
  branch: string | null;
  status: string;
  workflowRunUrl: string | null;
  triggeredBy: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
}

export async function listBuildRecords(productId: string): Promise<{ items: BuildRecordRow[]; source: Source }> {
  const data = await get<BuildRecordRow[]>(`/api/engineering/ci/builds?productId=${encodeURIComponent(productId)}`);
  return { items: Array.isArray(data) ? data : [], source: data ? "api" : "offline" };
}

export const BUILD_STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "error"> = {
  QUEUED: "neutral", RUNNING: "info", SUCCESS: "success", FAILURE: "error", CANCELLED: "neutral",
};

// ---- DG-09 Unified Control Framework ----------------------------------------

export interface ControlRow {
  id: string;
  code: string;
  domain: string;
  title: string;
  description: string | null;
  frameworkFamilies: string[];
}

export interface ControlImplementationRow {
  id: string;
  controlId: string;
  productId: string;
  status: string;
  evidenceRefs: string[];
  notes: string | null;
  control: ControlRow;
}

export async function listControls(): Promise<{ items: ControlRow[]; source: Source }> {
  const data = await get<ControlRow[]>("/api/engineering/controls");
  return { items: Array.isArray(data) ? data : [], source: data ? "api" : "offline" };
}

export async function listControlImplementations(productId: string): Promise<{ items: ControlImplementationRow[]; source: Source }> {
  const data = await get<ControlImplementationRow[]>(`/api/engineering/controls/implementations?productId=${encodeURIComponent(productId)}`);
  return { items: Array.isArray(data) ? data : [], source: data ? "api" : "offline" };
}

export const CONTROL_IMPL_STATUS_LABEL: Record<string, string> = {
  PROPOSED: "Đề xuất", IN_PLACE: "Đã áp dụng", PARTIAL: "Một phần", NOT_APPLICABLE: "Không áp dụng", RETIRED: "Ngừng dùng",
};

export const CONTROL_IMPL_STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "error"> = {
  PROPOSED: "neutral", IN_PLACE: "success", PARTIAL: "warning", NOT_APPLICABLE: "neutral", RETIRED: "error",
};

// ---- DG-10 AI Governance -----------------------------------------------------

export interface AIImpactAssessmentRow {
  id: string;
  status: string;
  risksIdentified: string | null;
  mitigations: string | null;
  approverRole: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface AISystemRow {
  id: string;
  code: string;
  productId: string;
  name: string;
  purpose: string | null;
  provider: string | null;
  riskTier: string;
  status: string;
  humanOversight: string | null;
  standardsRefs: string[];
  impactAssessments: AIImpactAssessmentRow[];
}

export async function listAISystems(productId?: string): Promise<{ items: AISystemRow[]; source: Source }> {
  const qs = productId ? `?productId=${encodeURIComponent(productId)}` : "";
  const data = await get<AISystemRow[]>(`/api/engineering/ai-systems${qs}`);
  return { items: Array.isArray(data) ? data : [], source: data ? "api" : "offline" };
}

export const AI_RISK_TIER_LABEL: Record<string, string> = {
  MINIMAL: "Tối thiểu", LIMITED: "Giới hạn", HIGH: "Cao", UNACCEPTABLE: "Không chấp nhận được",
};

export const AI_RISK_TIER_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "error"> = {
  MINIMAL: "neutral", LIMITED: "info", HIGH: "warning", UNACCEPTABLE: "error",
};

// ---- DG-11 Privacy/DPIA -------------------------------------------------------

export interface PrivacyImpactAssessmentRow {
  id: string;
  status: string;
  risksIdentified: string | null;
  mitigations: string | null;
  approverRole: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface ProcessingActivityRow {
  id: string;
  code: string;
  productId: string;
  name: string;
  purpose: string | null;
  dataCategories: string[];
  legalBasis: string | null;
  status: string;
  standardsRefs: string[];
  assessments: PrivacyImpactAssessmentRow[];
}

export async function listProcessingActivities(productId?: string): Promise<{ items: ProcessingActivityRow[]; source: Source }> {
  const qs = productId ? `?productId=${encodeURIComponent(productId)}` : "";
  const data = await get<ProcessingActivityRow[]>(`/api/engineering/processing-activities${qs}`);
  return { items: Array.isArray(data) ? data : [], source: data ? "api" : "offline" };
}

// Shared by both AI impact assessments and DPIAs — same status set.
export const ASSESSMENT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp", IN_REVIEW: "Đang duyệt", APPROVED: "Đã duyệt", REJECTED: "Từ chối", NEEDS_UPDATE: "Cần cập nhật",
};

export const ASSESSMENT_STATUS_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "error"> = {
  DRAFT: "neutral", IN_REVIEW: "warning", APPROVED: "success", REJECTED: "error", NEEDS_UPDATE: "warning",
};
