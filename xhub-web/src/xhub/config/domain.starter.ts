export type TenantId = string;
export type EntityId = string;
export type ISODateTime = string;
export type MoneyVND = number;

export interface TenantScopedEntity {
  id: EntityId;
  tenantId: TenantId;
}

export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'new' | 'not_started' | 'in_progress' | 'waiting' | 'overdue' | 'completed';

export interface Task extends TenantScopedEntity {
  title: string;
  projectId?: EntityId | null;
  assigneeId: EntityId;
  dueDate: string;
  priority: Priority;
  status: TaskStatus;
  channelId?: EntityId | null;
  progress: number;
}

export interface Channel extends TenantScopedEntity {
  slug: string;
  name: string;
  type: 'public' | 'private' | 'direct';
  purpose?: string;
  projectId?: EntityId | null;
  customerId?: EntityId | null;
}

export interface Message extends TenantScopedEntity {
  channelId: EntityId;
  senderId: EntityId | 'system' | 'xai';
  sentAt: ISODateTime;
  content: string;
  type: 'text' | 'file' | 'task_card' | 'approval_card' | 'ai';
  threadId?: EntityId | null;
  linkedEntity?: { type: string; id: EntityId };
  documentIds?: EntityId[];
}
