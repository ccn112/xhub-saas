/**
 * Deterministic progress + health calculation for ExecutionProject (X.Office
 * Work & PM v2 — W2). NO AI — pure functions over the project's NativeWorkItems
 * per docs/03_PROJECT_MANAGEMENT_LOGIC.md. Used for both project-level roll-up
 * and per-parent WBS roll-up (a parent's progress is computed from its children
 * with the SAME method).
 */

export type ProgressMethod =
  | 'MANUAL'
  | 'TASK_WEIGHTED'
  | 'MILESTONE_WEIGHTED'
  | 'DELIVERABLE_WEIGHTED';

export const PROGRESS_METHODS: ProgressMethod[] = [
  'MANUAL',
  'TASK_WEIGHTED',
  'MILESTONE_WEIGHTED',
  'DELIVERABLE_WEIGHTED',
];

export interface ProgressInput {
  type: string;
  status: string;
  progressPercent: number;
  weight?: number | null;
}

/** A weighted average of task progress; weight defaults to 1 when null/0. */
function taskWeighted(items: ProgressInput[]): number {
  if (!items.length) return 0;
  let num = 0;
  let den = 0;
  for (const it of items) {
    const w = it.weight != null && it.weight > 0 ? it.weight : 1;
    num += w * clamp(it.progressPercent);
    den += w;
  }
  return den === 0 ? 0 : Math.round(num / den);
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
}

const DONE = (s: string) => s === 'DONE';

/**
 * Compute roll-up progress for a set of items under `method`. `manualValue` is
 * returned verbatim for MANUAL. For the milestone/deliverable methods, if the
 * subset is empty we fall back to a task-weighted roll-up so a project with no
 * milestone/deliverable still reports a meaningful number (deterministic).
 */
export function computeProgress(
  method: ProgressMethod,
  items: ProgressInput[],
  manualValue = 0,
): number {
  switch (method) {
    case 'MANUAL':
      return clamp(manualValue);
    case 'MILESTONE_WEIGHTED': {
      const ms = items.filter((i) => i.type === 'MILESTONE');
      if (!ms.length) return taskWeighted(items);
      const done = ms.filter((m) => DONE(m.status)).length;
      return Math.round((done / ms.length) * 100);
    }
    case 'DELIVERABLE_WEIGHTED': {
      const dl = items.filter((i) => i.type === 'DELIVERABLE');
      if (!dl.length) return taskWeighted(items);
      return taskWeighted(dl);
    }
    case 'TASK_WEIGHTED':
    default:
      return taskWeighted(items);
  }
}

export interface HealthInput {
  status: string;
  hasBaseline: boolean;
  baselineFinish?: Date | string | null;
  forecastFinish?: Date | string | null;
  plannedFinish?: Date | string | null;
  overdueItemCount: number;
  overdueMilestoneCount: number;
  blockedHighCount: number;
}

const DAY = 24 * 3600 * 1000;

/**
 * Deterministic health per docs/03 (tenant-configurable thresholds hard-coded to
 * the documented default here):
 *   - UNKNOWN: no baseline AND no planned finish (cannot judge).
 *   - RED:  a key milestone missed, OR forecast slips beyond the red threshold
 *           (>14d), OR a high-severity blocker exists.
 *   - YELLOW: forecast slips beyond the yellow threshold (>3d) OR any overdue item.
 *   - GREEN: none of the above.
 */
export function computeHealth(i: HealthInput): 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN' {
  if (i.status === 'COMPLETED') return 'GREEN';
  if (i.status === 'CANCELLED') return 'UNKNOWN';
  const ref = i.hasBaseline ? i.baselineFinish : i.plannedFinish;
  if (!ref && !i.forecastFinish) return 'UNKNOWN';

  const YELLOW_D = 3;
  const RED_D = 14;
  let slipDays = 0;
  if (ref && i.forecastFinish) {
    slipDays = Math.round((new Date(i.forecastFinish).getTime() - new Date(ref).getTime()) / DAY);
  }

  if (i.overdueMilestoneCount > 0 || slipDays > RED_D || i.blockedHighCount > 0) return 'RED';
  if (slipDays > YELLOW_D || i.overdueItemCount > 0) return 'YELLOW';
  return 'GREEN';
}
