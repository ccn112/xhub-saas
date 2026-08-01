// Domain types for the X.Office workflow module (POC in-memory slice).
// The WorkflowDefinitionDocument is the canonical DSL; canvas x/y is presentation only.

export type NodeType =
  | 'start'
  | 'approval'
  | 'humanTask'
  | 'form'
  | 'condition'
  | 'parallelSplit'
  | 'parallelJoin'
  | 'timer'
  | 'notification'
  | 'serviceCall'
  | 'subflow'
  | 'aiAssist'
  | 'end';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  name: string;
  config: Record<string, any>;
  position?: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface WorkflowMetadata {
  tenantSlug: string;
  code: string;
  name: string;
  description?: string;
  ownerRoleCode?: string;
  // System of Record ownership from the pilot handoff (e.g. XOFFICE / FRAPPE_HR / FINERP).
  systemOfRecord?: string;
  ownerSystem?: string;
  wave?: string | null;
  aiPolicy?: Record<string, boolean>;
}

export interface WorkflowDefinitionDocument {
  schemaVersion: string;
  metadata: WorkflowMetadata;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables?: any[];
  forms?: any[];
  presentation?: Record<string, any>;
}

export interface WorkflowVersion {
  tenantSlug: string;
  code: string;
  version: number;
  publishedAt: string;
  checksum: string;
  definition: WorkflowDefinitionDocument; // immutable snapshot
}

export interface ValidationIssue {
  level: 'error' | 'warning';
  nodeId?: string;
  message: string;
}

export interface SimulationResult {
  path: string[];
  steps: {
    nodeId: string;
    name: string;
    outcome: string;
    // dry-run resolved connector payload for serviceCall nodes (mapping preview)
    connectorPreview?: ConnectorResolveResult;
  }[];
  reachedEnd: boolean;
}

// ---- connector catalog + mapping (data-driven) ----------------------------

export type MappingTransform = 'none' | 'toNumber' | 'toString' | 'join' | 'constant';

export interface ConnectorMapping {
  target: string;
  source: string;
  required?: boolean;
  transform?: MappingTransform;
  constant?: unknown;
}

export interface ConnectorNodeConfig {
  connectorCode: string;
  actionCode: string;
  mappings?: ConnectorMapping[];
  retry?: { maxAttempts?: number };
  // External Action mode (external-action.schema.json). When absent the engine
  // derives it: office-owned connectors → AUTO (simulate); external not-live
  // (finerp / frappe-hr / esign) → MANUAL_TASK (park + manual reference entry).
  executionMode?: 'AUTO' | 'MANUAL_TASK' | 'WAITING_FOR_CONNECTOR';
  // Role that receives the manual-execution task when the connector is not live.
  fallbackAssigneeRole?: string;
}

// Resolved execution mode for a serviceCall node.
export type ServiceCallMode = 'AUTO' | 'MANUAL_TASK' | 'WAITING_FOR_CONNECTOR';

export interface ExternalExecutionView {
  id: string;
  tenantSlug: string;
  instanceCode: string;
  nodeId: string;
  connectorCode: string;
  actionCode: string;
  mode: string;
  status: string;
  payload: Record<string, unknown>;
  referenceCode: string | null;
  referenceSystem: string | null;
  enteredBy: string | null;
  enteredAt: string | null;
  sourceRef: Record<string, unknown> | null;
  note: string | null;
  createdAt: string;
}

export interface ConnectorTargetField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
}

export interface ConnectorAction {
  code: string;
  name: string;
  eventOnComplete?: string;
  targetFields: ConnectorTargetField[];
}

export interface ConnectorDefinition {
  code: string;
  name: string;
  ownerSystem?: string;
  boundary?: string;
  actions: ConnectorAction[];
}

export interface ConnectorCatalog {
  version: string;
  note?: string;
  connectors: ConnectorDefinition[];
}

export interface ConnectorResolveResult {
  connectorCode: string;
  actionCode: string;
  payload: Record<string, unknown>;
  missingRequired: string[];
}

export interface ConnectorCommandView {
  id: string;
  tenantSlug: string;
  instanceCode: string;
  nodeId: string;
  connectorCode: string;
  actionCode: string;
  payload: Record<string, unknown>;
  status: string;
  result: Record<string, unknown> | null;
  error: string | null;
  attempts: number;
  createdAt: string;
}

export interface WorkflowInstance {
  tenantSlug: string;
  workflowCode: string;
  instanceCode: string;
  title: string;
  requesterEmail: string;
  variables: Record<string, any>;
  status: 'running' | 'completed' | 'rejected';
  currentNodeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalTask {
  id: string;
  tenantSlug: string;
  instanceCode: string;
  nodeId: string;
  nodeName: string;
  assigneeRole: string;
  // Resolved recipient (from role-bindings); null when the role has no mapped user (queue).
  assigneeUserId?: string | null;
  status: 'open' | 'approved' | 'rejected';
  slaHours?: number;
  escalated?: boolean;
  createdAt: string;
}

export interface Delegation {
  id: string;
  tenantSlug: string;
  fromUserId: string;
  toUserId: string;
  fromAt: string;
  toAt: string;
  reason?: string | null;
  createdAt: string;
}

export interface NotificationView {
  id: string;
  tenantSlug: string;
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  sourceSystem?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  deepLink?: string | null;
  channelHint: string;
  createdAt: string;
  readAt?: string | null;
}

export interface AuditEvent {
  id: string;
  tenantSlug: string;
  at: string;
  actorId: string;
  instanceCode: string;
  action: string;
  detail: string;
}

export interface PatchOperation {
  op: 'add' | 'replace' | 'remove' | 'move';
  path: string;
  from?: string;
  value?: any;
}

export interface WorkflowPatchSet {
  summary: string;
  operations: PatchOperation[];
  assumptions: string[];
  evidence: { sourceType: string; sourceId: string; label: string }[];
  validation?: Record<string, any>;
  mustRequireHumanApply?: boolean;
}
