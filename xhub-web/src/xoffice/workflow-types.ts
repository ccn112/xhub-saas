// Canonical workflow definition types (DSL). Canvas x/y is presentation only.
import type { WorkflowNodeType } from './node-types';

export interface WorkflowNodePosition {
  x: number;
  y: number;
}

export interface WorkflowNodeDoc {
  id: string;
  type: WorkflowNodeType;
  name: string;
  config: Record<string, unknown>;
  position: WorkflowNodePosition;
}

export interface WorkflowEdgeDoc {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface WorkflowMetadata {
  tenantSlug: string;
  code: string;
  name: string;
  description: string;
  ownerRoleCode: string;
}

export interface WorkflowDefinitionDocument {
  schemaVersion: string;
  metadata: WorkflowMetadata;
  nodes: WorkflowNodeDoc[];
  edges: WorkflowEdgeDoc[];
  variables?: unknown[];
  forms?: unknown[];
  presentation?: {
    viewport?: { x: number; y: number; zoom: number };
  };
  // Optional fields the backend list endpoint may add.
  version?: number | string;
  usage?: number;
}

export interface NodeCatalogEntry {
  type: WorkflowNodeType;
  name: string;
  category: string;
  icon: string;
  description: string;
}

// Validation issue shape (matches backend /validate response, best-effort).
export interface WorkflowValidationIssue {
  code?: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  nodeId?: string;
}

export interface WorkflowValidationResult {
  ok: boolean;
  issues: WorkflowValidationIssue[];
}
