// Extra domain types beyond the core set, used by specific screens.
export * from "./types";

export interface Directive {
  id: string; tenantId: string; title: string; issuedBy?: string; ownerId?: string;
  projectId?: string; dueDate?: string; status: string; progress: number;
  objective?: string; taskIds?: string[];
}

export interface ProjectRisk {
  id: string; tenantId: string; projectId: string; title: string; severity: string;
  status: string; ownerId?: string; dueDate?: string; impact?: string;
}

export interface Milestone {
  id: string; tenantId: string; projectId: string; name: string; dueDate?: string;
  status?: string; progress?: number;
}

export interface Document {
  id: string; tenantId: string; name: string; type?: string; projectId?: string;
  customerId?: string; owner?: string; updatedAt?: string; size?: number; version?: string;
}

export interface Thread {
  id: string; tenantId: string; channelId: string; rootMessageId?: string;
  title?: string; participantIds?: string[];
}

export interface Ticket {
  id: string; tenantId: string; code?: string; title: string; status: string;
  priority?: string; customerId?: string; projectId?: string; assigneeId?: string;
  createdAt?: string; slaDueAt?: string;
}

export interface Contact {
  id: string; tenantId: string; customerId: string; name: string; title?: string;
  department?: string; email?: string; phone?: string; isPrimary?: boolean;
}

export interface Opportunity {
  id: string; tenantId: string; customerId: string; name: string; stage: string;
  amount?: number; probability?: number; ownerId?: string; expectedCloseDate?: string; products?: string[];
}

export interface Contract {
  id: string; tenantId: string; code?: string; customerId: string; name: string;
  value?: number; currency?: string; signedDate?: string; effectiveFrom?: string;
  effectiveTo?: string; status?: string; ownerId?: string;
}

export interface WorkflowStep { key: string; name: string }
export interface WorkflowDefinition {
  id: string; tenantId: string; name: string; version?: string; description?: string; steps: WorkflowStep[];
}
export interface WorkflowInstance {
  id: string; tenantId: string; workflowId: string; code?: string; customerId?: string;
  title: string; currentStep: string; status: string; ownerId?: string; slaHours?: number;
  dueAt?: string; formData?: Record<string, unknown>;
}
export interface WorkflowHistoryEntry {
  id: string; tenantId: string; instanceId: string; step: string; status: string;
  actorId?: string; at?: string; note?: string;
}
