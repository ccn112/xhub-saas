// XHub Enterprise IOC — SHARED twin-template specs (the "bộ template mẫu/chuẩn").
//
// This module is the SINGLE source of truth for the reusable twin layouts. It is
// imported by BOTH:
//   • scripts/ioc-template-catalog-seed.mjs → publishes them as `IocTemplate`
//     rows (shared / platform-plane, like Blueprint — no tenantId, no RLS);
//   • scripts/seed-ioc-twin.mjs             → materialises TPL-OFFICE into the
//     T001 reference slice, so the reference twin and the office template can
//     never drift apart (no duplicated zone list).
//
// A spec is deliberately TENANT-NEUTRAL:
//   • a zone carries an `orgHint` (candidate OrgUnit codes + Vietnamese keywords),
//     NOT an OrgUnit id — the clone resolves it against the CALLING tenant's real
//     org tree, and leaves the zone UNBOUND when nothing plausible matches
//     (Constitution #12: never invent an OrgUnit to make a demo look full);
//   • a data layer carries a `metricCode` (e.g. MFG-OEE), NOT a MetricDefinition
//     id — the clone resolves it inside the calling tenant and SKIPS the layer,
//     reporting why, when that tenant has no such metric.
//
// Geometry is METERS, polygons clockwise (matching ioc.geometry normalisation so
// checksums are stable).

/** Clockwise rectangle in meter space from [x1,y1,x2,y2]. */
export const rect = ([x1, y1, x2, y2]) => [
  { x: x1, y: y1 },
  { x: x1, y: y2 },
  { x: x2, y: y2 },
  { x: x2, y: y1 },
];

const perimeter = (w, h) => [
  {
    id: 'wall-perimeter',
    points: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }, { x: 0, y: 0 }],
    thickness: 0.2,
    height: 3,
  },
];

// ---------------------------------------------------------------------------
// Icon catalog — BUILT_IN semantic keys only (ADR-0006). Key pattern ^[a-z0-9-]+$.
// The 14 original office keys stay FIRST and unchanged (the T001 slice and the
// FE ICON_GLYPHS map depend on them); the industry keys are additive.
// ---------------------------------------------------------------------------
export const ICON_SETS = {
  office: [
    ['department-executive', 'Ban điều hành'],
    ['department-sales', 'Kinh doanh'],
    ['department-finance', 'Tài chính'],
    ['department-hr', 'Nhân sự'],
    ['department-it', 'CNTT'],
    ['department-operations', 'Vận hành'],
    ['department-pmo', 'PMO'],
    ['department-support', 'CSKH'],
    ['object-task', 'Task'],
    ['object-approval', 'Phê duyệt'],
    ['object-ticket', 'Ticket'],
    ['object-project', 'Dự án'],
    ['object-kpi', 'KPI'],
    ['object-risk', 'Rủi ro'],
  ],
  workplace: [
    ['space-meeting-room', 'Phòng họp'],
    ['space-workstation', 'Chỗ ngồi làm việc'],
    ['space-reception', 'Quầy lễ tân'],
  ],
  factory: [
    ['facility-factory', 'Nhà xưởng'],
    ['facility-machine', 'Máy / thiết bị'],
    ['facility-production-line', 'Dây chuyền sản xuất'],
    ['facility-qc-checkpoint', 'Trạm kiểm tra chất lượng'],
    ['facility-maintenance', 'Bảo trì thiết bị'],
  ],
  warehouse: [
    ['logistics-warehouse-rack', 'Kệ kho'],
    ['logistics-forklift', 'Xe nâng'],
    ['logistics-loading-dock', 'Bến xuất nhập hàng'],
  ],
  retail: [
    ['retail-shelf', 'Quầy kệ hàng'],
    ['retail-pos-counter', 'Quầy thu ngân (POS)'],
  ],
  hospitality: [
    ['hospitality-hotel-room', 'Phòng lưu trú'],
    ['hospitality-restaurant', 'Nhà hàng / F&B'],
    ['hospitality-housekeeping', 'Xe buồng phòng'],
  ],
};

/** Every icon the platform seeds, de-duplicated, in a stable order. */
export const ALL_ICONS = Object.values(ICON_SETS).flat();

// ---------------------------------------------------------------------------
// Data-layer specs.
//
// `zoneLevel: true`  → grouped by orgUnitId, so it CAN colour/annotate a zone
//                      and is attached to the scene bindings.
// `zoneLevel: false` → not org-grouped (e.g. a MetricObservation KPI). It is a
//                      dashboard-level number only; attaching it to a zone would
//                      imply a per-department reading that does not exist.
// `metricCode`       → must resolve to a MetricDefinition in the CLONING tenant,
//                      else the layer is skipped and reported.
// ---------------------------------------------------------------------------

/** Work-derived layers — safe in EVERY tenant (NativeWorkItem always exists). */
const workLayers = (prefix) => [
  {
    code: `${prefix}-WORKLOAD`,
    name: 'Tải công việc theo đơn vị',
    sourceKey: 'xoffice-work',
    entityKey: 'NativeWorkItem',
    zoneLevel: true,
    query: { filters: [{ field: 'status', operator: 'NOT_IN', value: ['DONE', 'CANCELLED'] }], timeWindow: 'LIVE', groupBy: ['orgUnitId'] },
    aggregation: { op: 'SUM', field: 'weightedDemand' },
    refreshPolicy: 'ONE_MINUTE',
    visualMapping: {
      mode: 'ZONE_COLOR',
      thresholds: [
        { min: 0, max: 6, state: 'NORMAL' },
        { min: 6, max: 12, state: 'GOOD' },
        { min: 12, max: 20, state: 'BUSY' },
        { min: 20, max: null, state: 'OVERLOADED' },
      ],
    },
  },
  {
    code: `${prefix}-HEADCOUNT`,
    name: 'Định biên có người giữ theo đơn vị',
    sourceKey: 'identity-org',
    entityKey: 'Position',
    zoneLevel: true,
    query: { filters: [], timeWindow: 'LIVE', groupBy: ['orgUnitId'] },
    aggregation: { op: 'DISTINCT_COUNT', field: 'holderPersonId' },
    refreshPolicy: 'FIVE_MINUTES',
    visualMapping: { mode: 'CARD', thresholds: [] },
  },
  {
    code: `${prefix}-PROJECT`,
    name: 'Dự án đang chạy theo đơn vị',
    sourceKey: 'xoffice-work',
    entityKey: 'ExecutionProject',
    zoneLevel: true,
    query: { filters: [{ field: 'status', operator: 'IN', value: ['PLANNED', 'ACTIVE', 'AT_RISK'] }], timeWindow: 'LIVE', groupBy: ['orgUnitId'] },
    aggregation: { op: 'COUNT', field: null },
    refreshPolicy: 'FIVE_MINUTES',
    visualMapping: { mode: 'BADGE', thresholds: [] },
  },
];

/** A Management-OS KPI layer, resolved per-tenant by metric CODE. */
const metricLayer = (code, name, metricCode) => ({
  code,
  name,
  sourceKey: 'manage-os',
  entityKey: 'MetricObservation',
  zoneLevel: false,
  metricCode,
  query: { filters: [], timeWindow: 'LAST_30D', groupBy: ['metricId'] },
  aggregation: { op: 'AVG', field: 'value' },
  refreshPolicy: 'FIVE_MINUTES',
  visualMapping: { mode: 'CARD', thresholds: [] },
});

// ---------------------------------------------------------------------------
// The 4 published templates.
// ---------------------------------------------------------------------------

/** TPL-OFFICE — the T001 reference layout, promoted to a reusable template. */
const OFFICE = {
  code: 'TPL-OFFICE',
  name: 'Văn phòng doanh nghiệp (8 phòng ban)',
  industry: 'Doanh nghiệp đa ngành / khối văn phòng',
  twinType: 'OFFICE',
  description:
    'Mặt bằng một tầng văn phòng 42×15 m với 8 vùng phòng ban chuẩn (điều hành, kinh doanh, tài chính, nhân sự, công nghệ, giải pháp, triển khai, hỗ trợ). Lớp dữ liệu lấy từ Work v2 và Định biên — chạy được ở mọi tenant.',
  iconSetCodes: ['office', 'workplace'],
  floorPlanSpec: {
    name: 'Mặt bằng văn phòng — Tầng điển hình',
    unit: 'METER',
    metersPerUnit: 1,
    originX: 0,
    originY: 0,
    walls: perimeter(42, 15),
    zones: [
      { id: 'zone-exec', name: 'Ban Điều hành', kind: 'DEPARTMENT', icon: 'department-executive', box: [0, 0, 10, 7], orgHint: { codes: ['EXEC', 'BOD', 'ROOT'], keywords: ['điều hành', 'ban giám đốc', 'tổng giám đốc'], type: 'DEPARTMENT' } },
      { id: 'zone-sales', name: 'Kinh doanh', kind: 'DEPARTMENT', icon: 'department-sales', box: [10, 0, 22, 7], orgHint: { codes: ['SALES', 'SEED-SALES', 'KD'], keywords: ['kinh doanh', 'bán hàng', 'sales'], type: 'DEPARTMENT' } },
      { id: 'zone-fin', name: 'Tài chính - Kế toán', kind: 'DEPARTMENT', icon: 'department-finance', box: [22, 0, 32, 7], orgHint: { codes: ['FIN', 'ACC'], keywords: ['tài chính', 'kế toán'], type: 'DEPARTMENT' } },
      { id: 'zone-hr', name: 'Nhân sự', kind: 'DEPARTMENT', icon: 'department-hr', box: [32, 0, 42, 7], orgHint: { codes: ['HR'], keywords: ['nhân sự', 'hành chính nhân sự'], type: 'DEPARTMENT' } },
      { id: 'zone-tech', name: 'Công nghệ', kind: 'DEPARTMENT', icon: 'department-it', box: [0, 7, 10, 15], orgHint: { codes: ['TECH', 'IT'], keywords: ['công nghệ', 'cntt', 'kỹ thuật'], type: 'DEPARTMENT' } },
      { id: 'zone-solution', name: 'Giải pháp', kind: 'DEPARTMENT', icon: 'department-operations', box: [10, 7, 22, 15], orgHint: { codes: ['SOLUTION', 'OPS'], keywords: ['giải pháp', 'vận hành'], type: 'DEPARTMENT' } },
      { id: 'zone-delivery', name: 'Triển khai', kind: 'DEPARTMENT', icon: 'department-pmo', box: [22, 7, 32, 15], orgHint: { codes: ['DELIVERY', 'PMO'], keywords: ['triển khai', 'dự án', 'pmo'], type: 'DEPARTMENT' } },
      { id: 'zone-support', name: 'Hỗ trợ', kind: 'DEPARTMENT', icon: 'department-support', box: [32, 7, 42, 15], orgHint: { codes: ['SUPPORT', 'CS'], keywords: ['hỗ trợ', 'chăm sóc khách hàng', 'cskh'], type: 'DEPARTMENT' } },
    ],
  },
  sceneSpec: { name: 'Bản sao số văn phòng', themeKey: 'ioc-navy', wallHeightMeters: 3 },
  dataLayerSpecs: workLayers('DL'),
  dashboardSpec: {
    code: 'DASH-OFFICE',
    name: 'Office Digital Twin Command Center',
    viewType: 'OFFICE_TWIN',
    globalFilters: ['orgUnitId', 'timeWindow'],
    widgets: [
      { id: 'w-kpi-workload', type: 'KPI', title: 'Tổng tải công việc', layerCode: 'DL-WORKLOAD', layout: { x: 0, y: 0, w: 3, h: 1 } },
      { id: 'w-kpi-headcount', type: 'KPI', title: 'Định biên có người giữ', layerCode: 'DL-HEADCOUNT', layout: { x: 3, y: 0, w: 3, h: 1 } },
      { id: 'w-kpi-projects', type: 'KPI', title: 'Dự án đang chạy', layerCode: 'DL-PROJECT', layout: { x: 6, y: 0, w: 3, h: 1 } },
      { id: 'w-scene', type: 'SCENE_3D', title: 'Bản sao số văn phòng', layerCode: null, layout: { x: 0, y: 1, w: 9, h: 8 } },
      { id: 'w-rank', type: 'WORKLOAD_RANKING', title: 'Xếp hạng tải theo phòng ban', layerCode: 'DL-WORKLOAD', layout: { x: 9, y: 1, w: 3, h: 8 } },
      { id: 'w-heat', type: 'HEATMAP', title: 'Bản đồ nhiệt tải', layerCode: 'DL-WORKLOAD', layout: { x: 0, y: 9, w: 6, h: 3 } },
      { id: 'w-table', type: 'TABLE', title: 'Định biên theo phòng ban', layerCode: 'DL-HEADCOUNT', layout: { x: 6, y: 9, w: 6, h: 3 } },
    ],
  },
};

/** TPL-FACTORY — Sản xuất công nghiệp (vocabulary of the T003 demo). */
const FACTORY = {
  code: 'TPL-FACTORY',
  name: 'Xưởng sản xuất (dây chuyền + QC + kho)',
  industry: 'Sản xuất công nghiệp',
  twinType: 'FACTORY',
  description:
    'Mặt bằng xưởng 60×24 m theo dòng chảy sản xuất: kho nguyên liệu đầu vào → hai dây chuyền lắp ráp → trạm QC → kho thành phẩm, kèm khu bảo trì thiết bị và văn phòng điều hành xưởng. Bổ sung chỉ số OEE và tỷ lệ lỗi khi tenant đã có bộ KPI ngành sản xuất.',
  iconSetCodes: ['factory', 'warehouse', 'office'],
  floorPlanSpec: {
    name: 'Mặt bằng xưởng sản xuất',
    unit: 'METER',
    metersPerUnit: 1,
    originX: 0,
    originY: 0,
    walls: perimeter(60, 24),
    zones: [
      { id: 'zone-raw-store', name: 'Kho nguyên liệu đầu vào', kind: 'SERVICE', icon: 'logistics-warehouse-rack', box: [0, 0, 12, 12], orgHint: { codes: ['WH-IN', 'KHO-NVL', 'WAREHOUSE'], keywords: ['kho nguyên liệu', 'nguyên vật liệu', 'kho đầu vào'], type: 'DEPARTMENT' } },
      { id: 'zone-line-1', name: 'Dây chuyền lắp ráp 1', kind: 'DEPARTMENT', icon: 'facility-production-line', box: [12, 0, 34, 6], orgHint: { codes: ['LINE-1', 'PROD-1', 'PROD'], keywords: ['dây chuyền 1', 'lắp ráp 1', 'sản xuất'], type: 'DEPARTMENT' } },
      { id: 'zone-line-2', name: 'Dây chuyền lắp ráp 2', kind: 'DEPARTMENT', icon: 'facility-production-line', box: [12, 6, 34, 12], orgHint: { codes: ['LINE-2', 'PROD-2'], keywords: ['dây chuyền 2', 'lắp ráp 2'], type: 'DEPARTMENT' } },
      { id: 'zone-qc', name: 'Trạm kiểm tra chất lượng (QC)', kind: 'RESTRICTED', icon: 'facility-qc-checkpoint', box: [34, 0, 44, 12], orgHint: { codes: ['QC', 'QA'], keywords: ['chất lượng', 'kiểm tra', 'qc', 'qa'], type: 'DEPARTMENT' } },
      { id: 'zone-fg-store', name: 'Kho thành phẩm', kind: 'SERVICE', icon: 'logistics-forklift', box: [44, 0, 60, 12], orgHint: { codes: ['WH-FG', 'KHO-TP'], keywords: ['kho thành phẩm', 'thành phẩm', 'xuất hàng'], type: 'DEPARTMENT' } },
      { id: 'zone-maintenance', name: 'Bảo trì thiết bị', kind: 'SERVICE', icon: 'facility-maintenance', box: [0, 12, 20, 24], orgHint: { codes: ['MAINT', 'BT'], keywords: ['bảo trì', 'cơ điện', 'thiết bị'], type: 'DEPARTMENT' } },
      { id: 'zone-plant-office', name: 'Văn phòng điều hành xưởng', kind: 'DEPARTMENT', icon: 'facility-factory', box: [20, 12, 40, 24], orgHint: { codes: ['PLANT-OPS', 'EXEC', 'ROOT'], keywords: ['điều hành xưởng', 'quản đốc', 'điều hành'], type: 'DEPARTMENT' } },
      { id: 'zone-dock', name: 'Bến xuất nhập hàng', kind: 'COMMON', icon: 'logistics-loading-dock', box: [40, 12, 60, 24], orgHint: { codes: ['DOCK', 'LOGISTICS'], keywords: ['bến hàng', 'xuất nhập', 'giao nhận', 'logistics'], type: 'DEPARTMENT' } },
    ],
  },
  sceneSpec: { name: 'Bản sao số xưởng sản xuất', themeKey: 'ioc-navy', wallHeightMeters: 6 },
  dataLayerSpecs: [
    ...workLayers('DL-MFG'),
    metricLayer('DL-MFG-OEE', 'Hiệu suất thiết bị tổng thể (OEE)', 'MFG-OEE'),
    metricLayer('DL-MFG-DEFECT', 'Tỷ lệ lỗi sản xuất (defect rate)', 'MFG-DEFECT'),
  ],
  dashboardSpec: {
    code: 'DASH-FACTORY',
    name: 'Trung tâm điều hành xưởng sản xuất',
    viewType: 'OFFICE_TWIN',
    globalFilters: ['orgUnitId', 'timeWindow'],
    widgets: [
      { id: 'w-oee', type: 'GAUGE', title: 'OEE trung bình 30 ngày', layerCode: 'DL-MFG-OEE', layout: { x: 0, y: 0, w: 3, h: 1 } },
      { id: 'w-defect', type: 'KPI', title: 'Tỷ lệ lỗi (ppm)', layerCode: 'DL-MFG-DEFECT', layout: { x: 3, y: 0, w: 3, h: 1 } },
      { id: 'w-kpi-workload', type: 'KPI', title: 'Tải công việc xưởng', layerCode: 'DL-MFG-WORKLOAD', layout: { x: 6, y: 0, w: 3, h: 1 } },
      { id: 'w-scene', type: 'SCENE_3D', title: 'Bản sao số xưởng', layerCode: null, layout: { x: 0, y: 1, w: 9, h: 8 } },
      { id: 'w-rank', type: 'WORKLOAD_RANKING', title: 'Tải theo công đoạn', layerCode: 'DL-MFG-WORKLOAD', layout: { x: 9, y: 1, w: 3, h: 8 } },
      { id: 'w-table', type: 'TABLE', title: 'Định biên theo công đoạn', layerCode: 'DL-MFG-HEADCOUNT', layout: { x: 0, y: 9, w: 12, h: 3 } },
    ],
  },
};

/** TPL-RETAIL — Phân phối / bán lẻ (vocabulary of the T004 demo). */
const RETAIL = {
  code: 'TPL-RETAIL',
  name: 'Điểm bán lẻ (sàn bán + POS + kho)',
  industry: 'Phân phối và bán lẻ',
  twinType: 'RETAIL',
  description:
    'Mặt bằng cửa hàng 36×18 m: sàn trưng bày, dãy quầy thu ngân POS, kho hàng phía sau, bến nhận hàng và quầy chăm sóc khách. Bổ sung chỉ số vòng quay tồn kho và tỷ lệ hết hàng khi tenant đã có bộ KPI ngành phân phối.',
  iconSetCodes: ['retail', 'warehouse', 'office'],
  floorPlanSpec: {
    name: 'Mặt bằng điểm bán lẻ',
    unit: 'METER',
    metersPerUnit: 1,
    originX: 0,
    originY: 0,
    walls: perimeter(36, 18),
    zones: [
      { id: 'zone-sales-floor', name: 'Sàn trưng bày & bán hàng', kind: 'COMMON', icon: 'retail-shelf', box: [0, 0, 22, 12], orgHint: { codes: ['SALES', 'SEED-SALES', 'RETAIL'], keywords: ['bán hàng', 'kinh doanh', 'cửa hàng', 'sàn bán'], type: 'DEPARTMENT' } },
      { id: 'zone-pos', name: 'Quầy thu ngân (POS)', kind: 'SERVICE', icon: 'retail-pos-counter', box: [22, 0, 30, 12], orgHint: { codes: ['POS', 'CASHIER', 'FIN'], keywords: ['thu ngân', 'quầy tính tiền', 'pos'], type: 'DEPARTMENT' } },
      { id: 'zone-customer-service', name: 'Chăm sóc khách hàng', kind: 'SERVICE', icon: 'department-support', box: [30, 0, 36, 12], orgHint: { codes: ['CS', 'SUPPORT'], keywords: ['chăm sóc khách', 'cskh', 'hỗ trợ', 'đổi trả'], type: 'DEPARTMENT' } },
      { id: 'zone-stockroom', name: 'Kho hàng tại điểm bán', kind: 'RESTRICTED', icon: 'logistics-warehouse-rack', box: [0, 12, 20, 18], orgHint: { codes: ['STOCK', 'WH', 'KHO'], keywords: ['kho', 'tồn kho', 'hàng hoá'], type: 'DEPARTMENT' } },
      { id: 'zone-receiving', name: 'Bến nhận hàng', kind: 'RESTRICTED', icon: 'logistics-loading-dock', box: [20, 12, 30, 18], orgHint: { codes: ['DOCK', 'RECEIVING', 'LOGISTICS'], keywords: ['nhận hàng', 'giao nhận', 'bến hàng'], type: 'DEPARTMENT' } },
      { id: 'zone-back-office', name: 'Văn phòng cửa hàng', kind: 'DEPARTMENT', icon: 'department-operations', box: [30, 12, 36, 18], orgHint: { codes: ['STORE-OPS', 'ROOT', 'OPS'], keywords: ['quản lý cửa hàng', 'văn phòng', 'vận hành'], type: 'DEPARTMENT' } },
    ],
  },
  sceneSpec: { name: 'Bản sao số điểm bán lẻ', themeKey: 'ioc-navy', wallHeightMeters: 4 },
  dataLayerSpecs: [
    ...workLayers('DL-RET'),
    metricLayer('DL-RET-TURNS', 'Vòng quay tồn kho', 'DIST-TURNS'),
    metricLayer('DL-RET-OOS', 'Tỷ lệ hết hàng tại điểm bán', 'DIST-OOS'),
  ],
  dashboardSpec: {
    code: 'DASH-RETAIL',
    name: 'Trung tâm điều hành điểm bán',
    viewType: 'OFFICE_TWIN',
    globalFilters: ['orgUnitId', 'timeWindow'],
    widgets: [
      { id: 'w-turns', type: 'KPI', title: 'Vòng quay tồn kho', layerCode: 'DL-RET-TURNS', layout: { x: 0, y: 0, w: 3, h: 1 } },
      { id: 'w-oos', type: 'GAUGE', title: 'Tỷ lệ hết hàng (%)', layerCode: 'DL-RET-OOS', layout: { x: 3, y: 0, w: 3, h: 1 } },
      { id: 'w-kpi-workload', type: 'KPI', title: 'Tải công việc điểm bán', layerCode: 'DL-RET-WORKLOAD', layout: { x: 6, y: 0, w: 3, h: 1 } },
      { id: 'w-scene', type: 'SCENE_3D', title: 'Bản sao số điểm bán', layerCode: null, layout: { x: 0, y: 1, w: 9, h: 8 } },
      { id: 'w-rank', type: 'WORKLOAD_RANKING', title: 'Tải theo khu vực', layerCode: 'DL-RET-WORKLOAD', layout: { x: 9, y: 1, w: 3, h: 8 } },
      { id: 'w-table', type: 'TABLE', title: 'Định biên theo khu vực', layerCode: 'DL-RET-HEADCOUNT', layout: { x: 0, y: 9, w: 12, h: 3 } },
    ],
  },
};

/** TPL-HOSPITALITY — Khách sạn / dịch vụ lưu trú (vocabulary of the T006 demo). */
const HOSPITALITY = {
  code: 'TPL-HOSPITALITY',
  name: 'Khách sạn (sảnh + block phòng + F&B)',
  industry: 'Khách sạn, nghỉ dưỡng và dịch vụ',
  twinType: 'HOSPITALITY',
  description:
    'Mặt bằng khối dịch vụ khách sạn 48×20 m: sảnh & quầy lễ tân, hai block phòng lưu trú, nhà hàng/F&B, khu buồng phòng (housekeeping) và văn phòng hậu cần. Bổ sung tỷ lệ lấp đầy và RevPAR khi tenant đã có bộ KPI ngành lưu trú.',
  iconSetCodes: ['hospitality', 'workplace', 'office'],
  floorPlanSpec: {
    name: 'Mặt bằng khối dịch vụ khách sạn',
    unit: 'METER',
    metersPerUnit: 1,
    originX: 0,
    originY: 0,
    walls: perimeter(48, 20),
    zones: [
      { id: 'zone-lobby', name: 'Sảnh & quầy lễ tân', kind: 'COMMON', icon: 'space-reception', box: [0, 0, 16, 10], orgHint: { codes: ['FO', 'RECEPTION', 'FRONT-OFFICE'], keywords: ['lễ tân', 'sảnh', 'tiếp đón', 'front office'], type: 'DEPARTMENT' } },
      { id: 'zone-guest-block-a', name: 'Block phòng lưu trú A', kind: 'RESTRICTED', icon: 'hospitality-hotel-room', box: [16, 0, 32, 10], orgHint: { codes: ['ROOMS-A', 'ROOMS'], keywords: ['phòng lưu trú', 'buồng phòng a', 'block a'], type: 'DEPARTMENT' } },
      { id: 'zone-guest-block-b', name: 'Block phòng lưu trú B', kind: 'RESTRICTED', icon: 'hospitality-hotel-room', box: [32, 0, 48, 10], orgHint: { codes: ['ROOMS-B'], keywords: ['buồng phòng b', 'block b'], type: 'DEPARTMENT' } },
      { id: 'zone-fnb', name: 'Nhà hàng & F&B', kind: 'COMMON', icon: 'hospitality-restaurant', box: [0, 10, 18, 20], orgHint: { codes: ['FNB', 'F&B', 'RESTAURANT'], keywords: ['nhà hàng', 'ẩm thực', 'f&b', 'bếp'], type: 'DEPARTMENT' } },
      { id: 'zone-housekeeping', name: 'Buồng phòng (Housekeeping)', kind: 'SERVICE', icon: 'hospitality-housekeeping', box: [18, 10, 34, 20], orgHint: { codes: ['HK', 'HOUSEKEEPING'], keywords: ['buồng phòng', 'housekeeping', 'vệ sinh'], type: 'DEPARTMENT' } },
      { id: 'zone-back-office', name: 'Văn phòng hậu cần', kind: 'DEPARTMENT', icon: 'department-operations', box: [34, 10, 48, 20], orgHint: { codes: ['BACK-OFFICE', 'ROOT', 'OPS', 'HR'], keywords: ['hậu cần', 'văn phòng', 'hành chính', 'vận hành'], type: 'DEPARTMENT' } },
    ],
  },
  sceneSpec: { name: 'Bản sao số khối dịch vụ khách sạn', themeKey: 'ioc-navy', wallHeightMeters: 3.5 },
  dataLayerSpecs: [
    ...workLayers('DL-HOS'),
    metricLayer('DL-HOS-OCC', 'Tỷ lệ lấp đầy phòng', 'HOS-OCC'),
    metricLayer('DL-HOS-REVPAR', 'Doanh thu trên mỗi phòng sẵn có (RevPAR)', 'HOS-REVPAR'),
  ],
  dashboardSpec: {
    code: 'DASH-HOSPITALITY',
    name: 'Trung tâm điều hành khách sạn',
    viewType: 'OFFICE_TWIN',
    globalFilters: ['orgUnitId', 'timeWindow'],
    widgets: [
      { id: 'w-occ', type: 'GAUGE', title: 'Tỷ lệ lấp đầy (%)', layerCode: 'DL-HOS-OCC', layout: { x: 0, y: 0, w: 3, h: 1 } },
      { id: 'w-revpar', type: 'KPI', title: 'RevPAR', layerCode: 'DL-HOS-REVPAR', layout: { x: 3, y: 0, w: 3, h: 1 } },
      { id: 'w-kpi-workload', type: 'KPI', title: 'Tải công việc dịch vụ', layerCode: 'DL-HOS-WORKLOAD', layout: { x: 6, y: 0, w: 3, h: 1 } },
      { id: 'w-scene', type: 'SCENE_3D', title: 'Bản sao số khách sạn', layerCode: null, layout: { x: 0, y: 1, w: 9, h: 8 } },
      { id: 'w-rank', type: 'WORKLOAD_RANKING', title: 'Tải theo bộ phận dịch vụ', layerCode: 'DL-HOS-WORKLOAD', layout: { x: 9, y: 1, w: 3, h: 8 } },
      { id: 'w-table', type: 'TABLE', title: 'Định biên theo bộ phận', layerCode: 'DL-HOS-HEADCOUNT', layout: { x: 0, y: 9, w: 12, h: 3 } },
    ],
  },
};

export const IOC_TEMPLATES = [OFFICE, FACTORY, RETAIL, HOSPITALITY];

/** Look one up by code (throws — a missing template is a seed bug, not a state). */
export function templateByCode(code) {
  const t = IOC_TEMPLATES.find((x) => x.code === code);
  if (!t) throw new Error(`unknown IOC template code "${code}"`);
  return t;
}

/** Icons a template needs, de-duplicated and flattened to [key, label] pairs. */
export function iconsForTemplate(tpl) {
  const seen = new Set();
  const out = [];
  for (const set of tpl.iconSetCodes) {
    for (const pair of ICON_SETS[set] ?? []) {
      if (seen.has(pair[0])) continue;
      seen.add(pair[0]);
      out.push(pair);
    }
  }
  return out;
}

/** Zones expanded to real polygons (the shape a FloorPlanDefinition stores). */
export function zonePolygons(tpl) {
  return tpl.floorPlanSpec.zones.map((z) => ({
    id: z.id,
    name: z.name,
    kind: z.kind,
    icon: z.icon,
    orgHint: z.orgHint,
    polygon: rect(z.box),
  }));
}
