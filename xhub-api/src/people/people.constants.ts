/**
 * People Essentials — PE-01 (Leave & Availability). Allowed values for the
 * String-with-comment "enums" on the people models (project convention — no
 * Prisma enum blocks), mirrors ../manage/manage.constants.ts style.
 */

export const ATTENDANCE_MODES = ['XOFFICE', 'FRAPPE_HR', 'DEVICE', 'FILE_IMPORT'] as const;
export const LEAVE_MODES = ['XOFFICE', 'FRAPPE_HR'] as const;
export const PAYROLL_MODES = ['FINERP', 'EXTERNAL_API', 'FILE_IMPORT'] as const;

export const LEAVE_POLICY_CODES = ['ANNUAL', 'SICK', 'UNPAID', 'COMP', 'REMOTE'] as const;
export const LEAVE_POLICY_STATUSES = ['ACTIVE', 'RETIRED'] as const;

export const DAY_PARTS = ['FULL', 'AM', 'PM'] as const;

/** FSM for LeaveRequest.status. Key = current, value = allowed next states. */
export const LEAVE_TRANSITIONS: Record<string, string[]> = {
  // Self-cancel of a not-yet-approved request goes straight to CANCELLED (no
  // approval needed to withdraw your own pending ask); only an APPROVED
  // request needs the CANCEL_REQUESTED → cancel-approve round trip.
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['IN_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'CANCELLED'],
  IN_REVIEW: ['APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'CANCELLED'],
  CHANGES_REQUESTED: ['SUBMITTED', 'CANCELLED'],
  APPROVED: ['CANCEL_REQUESTED'],
  CANCEL_REQUESTED: ['CANCELLED', 'APPROVED'], // cancel-approve reverts to APPROVED if the cancel is rejected
  REJECTED: [],
  CANCELLED: [],
};

export const OT_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['IN_REVIEW', 'APPROVED', 'REJECTED'],
  IN_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['CANCELLED'],
  REJECTED: [],
  CANCELLED: [],
};

export const LEAVE_BALANCE_REASONS = [
  'ACCRUAL',
  'LEAVE_SUBMITTED',
  'LEAVE_APPROVED',
  'LEAVE_CANCELLED',
  'LEAVE_REJECTED',
  'HR_ADJUSTMENT',
  'CARRY_OVER',
  'INITIAL',
] as const;

export const OT_TYPES = ['NORMAL', 'WEEKEND', 'HOLIDAY', 'NIGHT'] as const;

export const IMPACT_PHASES = ['ON_SUBMIT', 'ON_APPROVE', 'ON_CANCEL'] as const;

// ---- PE-02 (Attendance & Correction) --------------------------------------

export const ATTENDANCE_EVENT_TYPES = ['CLOCK_IN', 'CLOCK_OUT'] as const;
export const ATTENDANCE_IMPORT_STATUSES = ['PREVIEWED', 'COMMITTED', 'ROLLED_BACK'] as const;
export const ATTENDANCE_DAY_STATUSES = [
  'PRESENT',
  'LATE',
  'HALF_DAY',
  'ABSENT',
  'LEAVE',
  'HOLIDAY',
  'WEEKEND',
] as const;

/** FSM for AttendanceCorrectionRequest.status. */
export const CORRECTION_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: [],
};

export const ATTENDANCE_IMPORT_TEMPLATE_VERSION = 'ATTENDANCE_IMPORT_V1';
/** CSV header for ATTENDANCE_IMPORT_V1 (order-sensitive, case-insensitive match). */
export const ATTENDANCE_IMPORT_COLUMNS = ['personId', 'date', 'clockIn', 'clockOut'] as const;
