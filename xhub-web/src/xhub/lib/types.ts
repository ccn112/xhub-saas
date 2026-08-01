// Domain types for XHub / X.Space (subset covering seed collections used by screens).
export type ID = string;
export type ISO = string;
export type Priority = "low" | "medium" | "high" | "critical";

export interface Tenant {
  id: ID;
  slug: string;
  name: string;
  legalName?: string;
  branding?: { productName: string; workspaceName: string; primaryColor: string; logoAsset?: string };
  features?: string[];
}

export interface User {
  id: ID; tenantId: ID; name: string; email: string; title?: string;
  departmentId?: string; primaryRole?: string; phone?: string;
  status?: string; presence?: "online" | "away" | "offline" | string; avatar?: string;
}

export interface Project {
  id: ID; tenantId: ID; code: string; name: string; customerId?: ID; productId?: ID;
  status: string; managerId?: ID; ownerId?: ID; startDate: string; endDate: string;
  progress: number; riskHigh?: number; openTasks?: number; openTickets?: number;
}

export interface Approval {
  id: ID; tenantId: ID; code: string; type: string; title: string; requesterId: ID;
  departmentId?: string; amount?: number; currency?: string; priority: Priority;
  status: string; createdAt: ISO; dueAt?: ISO; contractId?: ID; projectId?: ID;
  currentStep?: number; totalSteps?: number; summary?: string;
}

export interface ApprovalStep {
  id: ID; tenantId: ID; approvalId: ID; step: number; name: string;
  assigneeId?: ID; status: string; actedAt?: ISO | null;
}

export interface PaymentItem {
  id: ID; tenantId: ID; approvalId: ID; name: string; completion: number; value: number;
}

export interface KpiSnapshot {
  id: ID; tenantId: ID; scope: string; scopeId: string; period: string;
  metrics: Record<string, number>;
}

export interface RevenuePoint { tenantId: ID; month: string; value: number }
export interface RevenueByProduct { tenantId: ID; period: string; productId: ID; value: number }

export interface WorkItem {
  id: ID; tenantId: ID; type: string; title: string; sourceType: string; sourceId: ID;
  assignedTo?: ID; createdBy?: ID; dueAt?: ISO; priority: Priority; status: string;
  summary?: string; projectId?: ID; customerId?: ID;
}

export interface Task {
  id: ID; tenantId: ID; title: string; projectId?: ID | null; assigneeId: ID;
  dueDate: string; priority: Priority; status: string; channelId?: ID | null;
  progress: number; source?: string; createdAt?: ISO;
}

export interface Channel {
  id: ID; tenantId: ID; slug: string; name: string; section?: string;
  type: "public" | "private" | "direct"; purpose?: string; projectId?: ID | null; customerId?: ID | null;
}

export interface Message {
  id: ID; tenantId: ID; channelId: ID; senderId: ID | "system" | "xai"; sentAt: ISO;
  content: string; type: "text" | "file" | "task_card" | "approval_card" | "ai";
  threadId?: ID | null; linkedEntity?: { type: string; id: ID }; documentIds?: ID[];
}

export interface Customer {
  id: ID; tenantId: ID; code: string; name: string; industry?: string; segment?: string;
  status: string; ownerId?: ID; healthScore?: number; satisfaction?: number;
}

export interface AppCatalogItem {
  id: ID; tenantId: ID; productId?: ID; name: string; description?: string;
  status: string; users?: number; instances?: number; launchMode?: string; externalUrl?: string;
}

export interface Connector {
  id: ID; tenantId: ID; name: string; status: string; lastSyncAt?: ISO;
  latencyMs?: number; errorRate?: number;
}

export interface Notification {
  id: ID; tenantId: ID; userId: ID; type: string; title: string; body?: string;
  createdAt: ISO; read: boolean;
}

export interface CalendarEvent {
  id: ID; tenantId: ID; title: string; start: ISO; end: ISO; type: string;
  channelId?: ID; participantIds?: ID[];
}

export interface AiInsight {
  id: ID; tenantId: ID; [k: string]: unknown;
}

export interface DepartmentPerformance {
  id?: ID; tenantId: ID; [k: string]: unknown;
}
