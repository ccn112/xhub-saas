/**
 * XHub Enterprise IOC — COMPILED source/field catalog (Constitution #6, ADR-0005).
 *
 * This file is the ONLY place a queryable entity, field, operator, aggregation or
 * group key can be declared. It is a compile-time constant: a tenant CANNOT add
 * an entity by writing a row. A `DataLayerDefinition` stores nothing but
 * references into this catalog, and every write + every execution re-validates
 * against it. The frontend therefore never sends SQL, a Prisma filter, or a raw
 * field name that reaches the database.
 *
 * SoR (Constitution #1/#2): every entity below is READ-ONLY and owned elsewhere —
 * NativeWorkItem/ExecutionProject by X.Office Work v2, Position/OrgUnit by
 * Identity/Org, MetricObservation by the Management OS. IOC never writes them.
 *
 * AT-012 HARD BAN: there is deliberately NO camera, VMS, access-control,
 * biometric, attendance, badge-swipe or presence entity here, and
 * `assertEntity()` rejects anything not listed. An individual productivity score
 * derived from physical sensing is therefore *unrepresentable*, not merely
 * undocumented. Adding one requires the DT-08 legal/security readiness gate.
 */

export type FieldType = 'string' | 'number' | 'date' | 'enum' | 'stringArray';

export type Operator = 'EQ' | 'NE' | 'IN' | 'NOT_IN' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'BETWEEN' | 'IS_NULL';

export type AggOp = 'COUNT' | 'SUM' | 'AVG' | 'PERCENTILE' | 'DISTINCT_COUNT';

export interface CatalogField {
  key: string;
  label: string;
  type: FieldType;
  operators: Operator[];
  /** enum members, when type = 'enum' */
  values?: string[];
  /** true = computed by the engine, not a stored column (e.g. weightedDemand) */
  derived?: boolean;
  /** true = numeric field usable as an aggregation target */
  measure?: boolean;
}

export interface CatalogEntity {
  entityKey: string;
  sourceKey: string;
  label: string;
  /** The system of record that OWNS this entity. IOC only projects it. */
  ownedBy: string;
  fields: CatalogField[];
  aggregations: AggOp[];
  groupBy: string[];
  /** Field whose value carries a personId, used for the person→orgUnit fold. */
  personFields: string[];
  /** true = rows can identify an individual → aggregate by default (Constitution #7). */
  personal: boolean;
}

const NUM_OPS: Operator[] = ['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'IS_NULL'];
const ENUM_OPS: Operator[] = ['EQ', 'NE', 'IN', 'NOT_IN', 'IS_NULL'];
const DATE_OPS: Operator[] = ['GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'IS_NULL'];

export const IOC_CATALOG: CatalogEntity[] = [
  {
    entityKey: 'NativeWorkItem',
    sourceKey: 'xoffice-work',
    label: 'Công việc (Work v2)',
    ownedBy: 'X.Office Work & PM v2',
    personal: true,
    personFields: ['ownerId', 'assigneeIds'],
    fields: [
      { key: 'status', label: 'Trạng thái', type: 'enum', operators: ENUM_OPS, values: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'DONE', 'CANCELLED'] },
      { key: 'priority', label: 'Độ ưu tiên', type: 'enum', operators: ENUM_OPS, values: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] },
      { key: 'type', label: 'Loại', type: 'enum', operators: ENUM_OPS, values: ['TASK', 'SUBTASK', 'ACTION', 'MILESTONE', 'DELIVERABLE', 'FOLLOW_UP'] },
      { key: 'projectId', label: 'Dự án', type: 'string', operators: ['EQ', 'NE', 'IN', 'NOT_IN', 'IS_NULL'] },
      { key: 'ownerId', label: 'Người phụ trách', type: 'string', operators: ['EQ', 'IN', 'IS_NULL'] },
      { key: 'dueAt', label: 'Hạn', type: 'date', operators: DATE_OPS },
      { key: 'progressPercent', label: 'Tiến độ (%)', type: 'number', operators: NUM_OPS, measure: true },
      { key: 'weight', label: 'Trọng số', type: 'number', operators: NUM_OPS, measure: true },
      { key: 'estimateMinutes', label: 'Ước lượng (phút)', type: 'number', operators: NUM_OPS, measure: true },
      // DERIVED — computed by the engine, never a stored column, never written back
      // (the handoff seed's `weightedDemand` has no counterpart in the real schema).
      { key: 'weightedDemand', label: 'Tải quy đổi', type: 'number', operators: NUM_OPS, derived: true, measure: true },
      { key: 'isOverdue', label: 'Quá hạn', type: 'number', operators: NUM_OPS, derived: true, measure: true },
    ],
    aggregations: ['COUNT', 'SUM', 'AVG', 'DISTINCT_COUNT'],
    groupBy: ['orgUnitId', 'status', 'priority', 'type', 'projectId'],
  },
  {
    entityKey: 'ExecutionProject',
    sourceKey: 'xoffice-work',
    label: 'Dự án thực thi',
    ownedBy: 'X.Office Work & PM v2',
    personal: false,
    // ExecutionProject is the ONE entity that carries orgUnitId natively, so no
    // person→position fold is needed for it.
    personFields: ['projectManagerId', 'sponsorId'],
    fields: [
      { key: 'status', label: 'Trạng thái', type: 'enum', operators: ENUM_OPS, values: ['DRAFT', 'PLANNED', 'ACTIVE', 'ON_HOLD', 'AT_RISK', 'COMPLETED', 'CANCELLED'] },
      { key: 'health', label: 'Sức khoẻ', type: 'enum', operators: ENUM_OPS, values: ['GREEN', 'YELLOW', 'RED', 'UNKNOWN'] },
      { key: 'projectKind', label: 'Loại dự án', type: 'enum', operators: ENUM_OPS, values: ['INTERNAL', 'IMPLEMENTATION', 'PRODUCT', 'CUSTOMER_SUCCESS', 'OPERATIONS', 'OTHER'] },
      { key: 'orgUnitId', label: 'Đơn vị', type: 'string', operators: ['EQ', 'IN', 'IS_NULL'] },
      { key: 'progressPercent', label: 'Tiến độ (%)', type: 'number', operators: NUM_OPS, measure: true },
    ],
    aggregations: ['COUNT', 'AVG'],
    groupBy: ['orgUnitId', 'status', 'health'],
  },
  {
    entityKey: 'Position',
    sourceKey: 'identity-org',
    label: 'Vị trí & định biên',
    ownedBy: 'Identity/Org Core',
    // Position rows carry a holderPersonId, but the layer only ever exposes
    // COUNT/DISTINCT_COUNT per org unit — headcount, never a person metric.
    personal: true,
    personFields: ['holderPersonId'],
    fields: [
      { key: 'orgUnitId', label: 'Đơn vị', type: 'string', operators: ['EQ', 'IN'] },
      { key: 'isHead', label: 'Trưởng đơn vị', type: 'enum', operators: ENUM_OPS, values: ['true', 'false'] },
      { key: 'holderPersonId', label: 'Người giữ', type: 'string', operators: ['IS_NULL'] },
    ],
    aggregations: ['COUNT', 'DISTINCT_COUNT'],
    groupBy: ['orgUnitId'],
  },
  {
    entityKey: 'MetricObservation',
    sourceKey: 'manage-os',
    label: 'Quan trắc KPI (Management OS)',
    ownedBy: 'X.Office Management Operating System',
    personal: false,
    personFields: [],
    fields: [
      { key: 'metricId', label: 'Chỉ số', type: 'string', operators: ['EQ', 'IN'] },
      { key: 'value', label: 'Giá trị', type: 'number', operators: NUM_OPS, measure: true },
      { key: 'periodStart', label: 'Từ kỳ', type: 'date', operators: DATE_OPS },
      { key: 'confidence', label: 'Độ tin cậy', type: 'number', operators: NUM_OPS, measure: true },
    ],
    aggregations: ['COUNT', 'AVG', 'SUM'],
    groupBy: ['metricId'],
  },
];

export const TIME_WINDOWS = ['LIVE', 'TODAY', 'LAST_7D', 'LAST_30D'] as const;
export type TimeWindow = (typeof TIME_WINDOWS)[number];

export const VISUAL_MODES = ['BADGE', 'ZONE_COLOR', 'ZONE_HEIGHT', 'PULSE', 'TOKEN_COUNT', 'LINE_WIDTH', 'CARD'] as const;
export const ZONE_STATES = ['GOOD', 'NORMAL', 'BUSY', 'OVERLOADED', 'RISK', 'NO_DATA'] as const;
export const REFRESH_POLICIES = ['EVENT', 'FIVE_SECONDS', 'ONE_MINUTE', 'FIVE_MINUTES', 'MANUAL'] as const;

export const DASHBOARD_VIEW_TYPES = ['OFFICE_TWIN', 'DEPARTMENT_CAPACITY', 'PROCESS_PIPELINE', 'PEOPLE_POSITION', 'CUSTOM'] as const;
export const WIDGET_TYPES = [
  'KPI', 'GAUGE', 'TREND', 'TABLE', 'HEATMAP', 'ALERT_LIST', 'AI_BRIEF',
  'FLOOR_2D', 'SCENE_3D', 'PIPELINE', 'WORKLOAD_RANKING', 'SKILL_MATRIX', 'ACTION_LIST',
] as const;

export const BINDING_TYPES = ['ORG_UNIT', 'ROOM', 'RESOURCE', 'PROJECT', 'FLOW_STAGE'] as const;
export const ZONE_KINDS = ['ROOM', 'DEPARTMENT', 'COMMON', 'RESTRICTED', 'SERVICE'] as const;

/**
 * Entity keys a tenant is explicitly FORBIDDEN from ever registering, checked by
 * name so a future careless catalog addition still trips the guard (AT-012).
 */
export const BANNED_ENTITY_PATTERNS = [
  /camera/i, /cctv/i, /vms/i, /biometric/i, /fingerprint/i, /faceid/i, /face_?recognition/i,
  /attendance/i, /timekeep/i, /badge/i, /turnstile/i, /accesscontrol/i, /access_?control/i,
  /presence/i, /keystroke/i, /screenshot/i, /surveil/i,
];

export function findEntity(entityKey: string): CatalogEntity | undefined {
  return IOC_CATALOG.find((e) => e.entityKey === entityKey);
}

export function catalogSummary() {
  return IOC_CATALOG.map((e) => ({
    entityKey: e.entityKey,
    sourceKey: e.sourceKey,
    label: e.label,
    ownedBy: e.ownedBy,
    personal: e.personal,
    aggregations: e.aggregations,
    groupBy: e.groupBy,
    fields: e.fields.map((f) => ({ key: f.key, label: f.label, type: f.type, operators: f.operators, values: f.values, derived: !!f.derived, measure: !!f.measure })),
  }));
}
