/**
 * DTO contracts for the Work module read path (owner requirement #1 —
 * visibility tiers). The SERVER chooses which DTO to return per actor; the
 * client never filters. A summary-only viewer must NEVER receive description,
 * comments, checklist, attachments, or children.
 */

/** Fields safe to expose to a coordination (summary-only) viewer. */
export interface SummaryWorkItemDTO {
  tier: 'SUMMARY';
  id: string;
  title: string;
  type: string;
  isMilestone: boolean;
  status: string;
  progressPercent: number;
  plannedStart: Date | string | null;
  dueAt: Date | string | null;
  overdue: boolean;
}

/** Everything a full-access viewer may see. */
export interface FullWorkItemDTO {
  tier: 'FULL';
  [key: string]: unknown;
}

export type WorkItemDTO = SummaryWorkItemDTO | FullWorkItemDTO;

export interface CreateWorkItemDto {
  title: string;
  description?: string;
  type?: string;
  status?: string;
  priority?: string;
  projectId?: string | null;
  parentId?: string | null;
  wbsCode?: string | null;
  ownerId?: string | null;
  assigneeIds?: string[];
  plannedStart?: string | null;
  dueAt?: string | null;
  weight?: number | null;
  estimateMinutes?: number | null;
  progressPercent?: number;
  tags?: string[];
  dimensions?: Record<string, unknown>;
  sourceContext?: Record<string, unknown> | null;
}
