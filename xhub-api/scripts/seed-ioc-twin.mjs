// XHub Enterprise IOC — Digital Twin reference-slice seed (seed:ioc).
// Seeds ONE complete twin for T001 (tenant-xtech) straight to Postgres under RLS
// bypass (server NOT required). Idempotent (upsert by natural key). Run:
//   npm run seed:ioc
//
// The slice (START-HERE.md reference chain):
//   TwinSite(X-TECH HQ) → TwinFloor(Tầng 5)
//   → FloorPlanDefinition (8 department zones, METERS) → publish v1 (immutable)
//   → TwinScene → 8 SceneBinding onto the REAL tenant-xtech OrgUnits
//   → 3 DataLayerDefinition over EXISTING entities (Work / Position / Project)
//   → DashboardDefinition OFFICE_TWIN → publish v1
//
// NOT hardcoded anywhere in a component (Constitution #10): the FE reads all of
// this from /api/ioc/*. Zone→department mapping uses the REAL ou-* ids that
// Identity seeded — the handoff's `org-*` placeholders do not exist here.
//
// A SYSTEM-ISOLATION twin is seeded into tenant-demo-isolation carrying the
// MUST_NOT_LEAK markers so the RLS/isolation tests have something to prove.
import 'dotenv/config';
import pg from 'pg';
import { createHash } from 'node:crypto';

const TENANT = 'tenant-xtech';
const ISO_TENANT = 'tenant-demo-isolation';
const ACTOR = 'usr-ceo';

// zone id → real OrgUnit code (resolved to ids at runtime — never hardcode ids).
const ZONE_PLAN = [
  { id: 'zone-exec', name: 'Ban Điều hành', org: 'EXEC', icon: 'department-executive', box: [0, 0, 10, 7] },
  { id: 'zone-sales', name: 'Kinh doanh', org: 'SALES', icon: 'department-sales', box: [10, 0, 22, 7] },
  { id: 'zone-fin', name: 'Tài chính - Kế toán', org: 'FIN', icon: 'department-finance', box: [22, 0, 32, 7] },
  { id: 'zone-hr', name: 'Nhân sự', org: 'HR', icon: 'department-hr', box: [32, 0, 42, 7] },
  { id: 'zone-tech', name: 'Công nghệ', org: 'TECH', icon: 'department-it', box: [0, 7, 10, 15] },
  { id: 'zone-solution', name: 'Giải pháp', org: 'SOLUTION', icon: 'department-operations', box: [10, 7, 22, 15] },
  { id: 'zone-delivery', name: 'Triển khai', org: 'DELIVERY', icon: 'department-pmo', box: [22, 7, 32, 15] },
  { id: 'zone-support', name: 'Hỗ trợ', org: 'SUPPORT', icon: 'department-support', box: [32, 7, 42, 15] },
];

// Clockwise in meter space (the API normalizes, we match it so checksums are stable).
const rect = ([x1, y1, x2, y2]) => [
  { x: x1, y: y1 },
  { x: x1, y: y2 },
  { x: x2, y: y2 },
  { x: x2, y: y1 },
];

const ICONS = [
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
];

const DATA_LAYERS = [
  {
    id: 'ioc-dl-workload',
    code: 'DL-WORKLOAD',
    name: 'Tải công việc theo phòng ban',
    sourceKey: 'xoffice-work',
    entityKey: 'NativeWorkItem',
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
    id: 'ioc-dl-headcount',
    code: 'DL-HEADCOUNT',
    name: 'Định biên có người giữ theo phòng ban',
    sourceKey: 'identity-org',
    entityKey: 'Position',
    query: { filters: [], timeWindow: 'LIVE', groupBy: ['orgUnitId'] },
    aggregation: { op: 'DISTINCT_COUNT', field: 'holderPersonId' },
    refreshPolicy: 'FIVE_MINUTES',
    visualMapping: { mode: 'CARD', thresholds: [] },
  },
  {
    id: 'ioc-dl-projects',
    code: 'DL-PROJECT',
    name: 'Dự án đang chạy theo phòng ban',
    sourceKey: 'xoffice-work',
    entityKey: 'ExecutionProject',
    query: { filters: [{ field: 'status', operator: 'IN', value: ['PLANNED', 'ACTIVE', 'AT_RISK'] }], timeWindow: 'LIVE', groupBy: ['orgUnitId'] },
    aggregation: { op: 'COUNT', field: null },
    refreshPolicy: 'FIVE_MINUTES',
    visualMapping: { mode: 'BADGE', thresholds: [] },
  },
];

function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = canonical(v[k]);
    return out;
  }
  return v;
}
const checksumOf = (p) => createHash('sha256').update(JSON.stringify(canonical(p))).digest('hex');

const SITE_ID = 'ioc-site-xtech-hq';
const FLOOR_ID = 'ioc-floor-xtech-hq-f5';
const PLAN_ID = 'ioc-plan-xtech-hq-f5';
const SCENE_ID = 'ioc-scene-xtech-hq-f5';
const DASH_ID = 'ioc-dash-office';

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  // 0) Resolve the REAL OrgUnit ids by code (never hardcode them).
  const orgRows = (await c.query('SELECT id, code, name FROM "OrgUnit" WHERE "tenantId"=$1', [TENANT])).rows;
  const orgByCode = new Map(orgRows.map((r) => [r.code, r]));
  const missing = ZONE_PLAN.filter((z) => !orgByCode.has(z.org)).map((z) => z.org);
  if (missing.length) throw new Error(`OrgUnit code(s) not seeded for ${TENANT}: ${missing.join(', ')} — run the identity seed first`);

  // 1) Icon catalog (BUILT_IN only — ADR-0006).
  for (const [key, label] of ICONS) {
    await c.query(
      `INSERT INTO "IconAsset" (id,"tenantId",key,label,type,status,"createdAt")
       VALUES ($1,$2,$3,$4,'BUILT_IN','ACTIVE',now())
       ON CONFLICT ("tenantId",key) DO UPDATE SET label=EXCLUDED.label`,
      [`ioc-icon-${key}`, TENANT, key, label],
    );
  }

  // 2) Site + floor
  await c.query(
    `INSERT INTO "TwinSite" (id,"tenantId",code,name,address,timezone,status,"createdBy","createdAt","updatedAt")
     VALUES ($1,$2,'XTECH-HQ','Trụ sở X-TECH','Toà nhà X-TECH, Hà Nội','Asia/Ho_Chi_Minh','ACTIVE',$3,now(),now())
     ON CONFLICT ("tenantId",code) DO UPDATE SET name=EXCLUDED.name, "updatedAt"=now()`,
    [SITE_ID, TENANT, ACTOR],
  );
  await c.query(
    `INSERT INTO "TwinFloor" (id,"tenantId","siteId",code,name,"buildingLabel",level,status,"createdBy","createdAt","updatedAt")
     VALUES ($1,$2,$3,'XTECH-HQ-F5','Tầng 5','Toà A',5,'ACTIVE',$4,now(),now())
     ON CONFLICT ("tenantId",code) DO UPDATE SET name=EXCLUDED.name, "updatedAt"=now()`,
    [FLOOR_ID, TENANT, SITE_ID, ACTOR],
  );

  // 3) Floor plan draft (geometry in METERS)
  const geometry = {
    walls: [
      { id: 'wall-perimeter', points: [{ x: 0, y: 0 }, { x: 42, y: 0 }, { x: 42, y: 15 }, { x: 0, y: 15 }, { x: 0, y: 0 }], thickness: 0.2, height: 3 },
    ],
    zones: ZONE_PLAN.map((z) => ({
      id: z.id,
      name: z.name,
      kind: 'DEPARTMENT',
      orgUnitId: orgByCode.get(z.org).id,
      polygon: rect(z.box),
    })),
  };
  await c.query(
    `INSERT INTO "FloorPlanDefinition" (id,"tenantId","floorId",name,unit,"metersPerUnit","originX","originY",geometry,status,revision,"createdBy","createdAt","updatedAt")
     VALUES ($1,$2,$3,'Mặt bằng Tầng 5','METER',1,0,0,$4,'DRAFT',0,$5,now(),now())
     ON CONFLICT (id) DO UPDATE SET geometry=EXCLUDED.geometry, "updatedAt"=now()`,
    [PLAN_ID, TENANT, FLOOR_ID, JSON.stringify(geometry), ACTOR],
  );

  // 4) Publish plan v1 (immutable) — idempotent: only create v1 if absent.
  const planV = (await c.query('SELECT "versionNo" FROM "FloorPlanVersion" WHERE "tenantId"=$1 AND "planId"=$2 ORDER BY "versionNo" DESC LIMIT 1', [TENANT, PLAN_ID])).rows[0];
  let planVersionNo = planV?.versionNo;
  if (!planVersionNo) {
    planVersionNo = 1;
    const payload = {
      planId: PLAN_ID, floorId: FLOOR_ID, name: 'Mặt bằng Tầng 5', unit: 'METER', versionNo: 1,
      calibration: { metersPerUnit: 1, originX: 0, originY: 0 }, underlayAssetId: null,
      walls: geometry.walls, zones: geometry.zones,
    };
    await c.query(
      `INSERT INTO "FloorPlanVersion" (id,"tenantId","planId","versionNo",payload,checksum,status,"publishedBy","publishedAt",note)
       VALUES ($1,$2,$3,1,$4,$5,'PUBLISHED',$6,now(),'seed:ioc reference slice')`,
      [`${PLAN_ID}-v1`, TENANT, PLAN_ID, JSON.stringify(payload), checksumOf(payload), ACTOR],
    );
  }
  await c.query(`UPDATE "FloorPlanDefinition" SET status='PUBLISHED', "activeVersionNo"=$2 WHERE id=$1`, [PLAN_ID, planVersionNo]);

  // 5) Data layers (governed definitions over EXISTING entities)
  for (const dl of DATA_LAYERS) {
    await c.query(
      `INSERT INTO "DataLayerDefinition" (id,"tenantId",code,name,"sourceKey","entityKey",query,aggregation,"refreshPolicy","visualMapping",sensitivity,status,"createdBy","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'AGGREGATE','ACTIVE',$11,now(),now())
       ON CONFLICT ("tenantId",code) DO UPDATE SET name=EXCLUDED.name, query=EXCLUDED.query, aggregation=EXCLUDED.aggregation, "visualMapping"=EXCLUDED."visualMapping", "updatedAt"=now()`,
      [dl.id, TENANT, dl.code, dl.name, dl.sourceKey, dl.entityKey, JSON.stringify(dl.query), JSON.stringify(dl.aggregation), dl.refreshPolicy, JSON.stringify(dl.visualMapping), ACTOR],
    );
  }
  const layerIds = (await c.query('SELECT id, code FROM "DataLayerDefinition" WHERE "tenantId"=$1', [TENANT])).rows;
  const layerByCode = new Map(layerIds.map((r) => [r.code, r.id]));
  const allLayers = ['DL-WORKLOAD', 'DL-HEADCOUNT', 'DL-PROJECT'].map((k) => layerByCode.get(k)).filter(Boolean);

  // 6) Scene + bindings onto the REAL org units
  await c.query(
    `INSERT INTO "TwinScene" (id,"tenantId",name,"floorId","planId","floorPlanVersionNo","themeKey","wallHeightMeters",status,revision,"createdBy","createdAt","updatedAt")
     VALUES ($1,$2,'X-TECH HQ — Tầng 5',$3,$4,$5,'ioc-navy',3,'DRAFT',0,$6,now(),now())
     ON CONFLICT (id) DO UPDATE SET "floorPlanVersionNo"=EXCLUDED."floorPlanVersionNo", "updatedAt"=now()`,
    [SCENE_ID, TENANT, FLOOR_ID, PLAN_ID, planVersionNo, ACTOR],
  );
  for (const z of ZONE_PLAN) {
    await c.query(
      `INSERT INTO "SceneBinding" (id,"tenantId","sceneId","zoneId","bindingType","bindingId","iconKey","materialKey","dataLayerIds","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,'ORG_UNIT',$5,$6,'status-dynamic',$7,now(),now())
       ON CONFLICT ("tenantId","sceneId","zoneId") DO UPDATE SET "bindingId"=EXCLUDED."bindingId", "iconKey"=EXCLUDED."iconKey", "dataLayerIds"=EXCLUDED."dataLayerIds", "updatedAt"=now()`,
      [`ioc-bind-${z.id}`, TENANT, SCENE_ID, z.id, orgByCode.get(z.org).id, z.icon, allLayers],
    );
  }

  // 7) Publish scene v1 (immutable)
  const sceneV = (await c.query('SELECT "versionNo" FROM "TwinSceneVersion" WHERE "tenantId"=$1 AND "sceneId"=$2 ORDER BY "versionNo" DESC LIMIT 1', [TENANT, SCENE_ID])).rows[0];
  let sceneVersionNo = sceneV?.versionNo;
  if (!sceneVersionNo) {
    sceneVersionNo = 1;
    const payload = {
      sceneId: SCENE_ID, name: 'X-TECH HQ — Tầng 5', floorId: FLOOR_ID, themeKey: 'ioc-navy', wallHeightMeters: 3,
      versionNo: 1, floorPlanVersionId: `${PLAN_ID}-v1`, floorPlanVersionNo: planVersionNo,
      floorPlanChecksum: checksumOf({ planId: PLAN_ID }), // informational in the seed
      geometry: { walls: geometry.walls, zones: geometry.zones },
      calibration: { metersPerUnit: 1, originX: 0, originY: 0 },
      bindings: ZONE_PLAN.map((z) => ({
        zoneId: z.id, bindingType: 'ORG_UNIT', bindingId: orgByCode.get(z.org).id,
        iconKey: z.icon, materialKey: 'status-dynamic', dataLayerIds: allLayers,
      })).sort((a, b) => a.zoneId.localeCompare(b.zoneId)),
    };
    await c.query(
      `INSERT INTO "TwinSceneVersion" (id,"tenantId","sceneId","versionNo",payload,checksum,status,"publishedBy","publishedAt",note)
       VALUES ($1,$2,$3,1,$4,$5,'PUBLISHED',$6,now(),'seed:ioc reference slice')`,
      [`${SCENE_ID}-v1`, TENANT, SCENE_ID, JSON.stringify(payload), checksumOf(payload), ACTOR],
    );
  }
  await c.query(`UPDATE "TwinScene" SET status='PUBLISHED', "activeVersionNo"=$2 WHERE id=$1`, [SCENE_ID, sceneVersionNo]);

  // 8) Office Twin dashboard + publish v1
  const widgets = [
    { id: 'w-kpi-workload', type: 'KPI', title: 'Tổng tải công việc', dataLayerId: layerByCode.get('DL-WORKLOAD'), layout: { x: 0, y: 0, w: 3, h: 1 } },
    { id: 'w-kpi-headcount', type: 'KPI', title: 'Định biên có người giữ', dataLayerId: layerByCode.get('DL-HEADCOUNT'), layout: { x: 3, y: 0, w: 3, h: 1 } },
    { id: 'w-kpi-projects', type: 'KPI', title: 'Dự án đang chạy', dataLayerId: layerByCode.get('DL-PROJECT'), layout: { x: 6, y: 0, w: 3, h: 1 } },
    { id: 'w-scene', type: 'SCENE_3D', title: 'Bản sao số văn phòng', dataLayerId: null, layout: { x: 0, y: 1, w: 9, h: 8 } },
    { id: 'w-rank', type: 'WORKLOAD_RANKING', title: 'Xếp hạng tải theo phòng ban', dataLayerId: layerByCode.get('DL-WORKLOAD'), layout: { x: 9, y: 1, w: 3, h: 8 } },
    { id: 'w-heat', type: 'HEATMAP', title: 'Bản đồ nhiệt tải', dataLayerId: layerByCode.get('DL-WORKLOAD'), layout: { x: 0, y: 9, w: 6, h: 3 } },
    { id: 'w-table', type: 'TABLE', title: 'Định biên theo phòng ban', dataLayerId: layerByCode.get('DL-HEADCOUNT'), layout: { x: 6, y: 9, w: 6, h: 3 } },
  ];
  await c.query(
    `INSERT INTO "DashboardDefinition" (id,"tenantId",code,name,"viewType","sceneId","globalFilters",widgets,status,revision,"createdBy","createdAt","updatedAt")
     VALUES ($1,$2,'DASH-OFFICE','Office Digital Twin Command Center','OFFICE_TWIN',$3,ARRAY['orgUnitId','timeWindow']::text[],$4,'DRAFT',0,$5,now(),now())
     ON CONFLICT ("tenantId",code) DO UPDATE SET widgets=EXCLUDED.widgets, "sceneId"=EXCLUDED."sceneId", "updatedAt"=now()`,
    [DASH_ID, TENANT, SCENE_ID, JSON.stringify(widgets), ACTOR],
  );
  const dashV = (await c.query('SELECT "versionNo" FROM "DashboardVersion" WHERE "tenantId"=$1 AND "dashboardId"=$2 ORDER BY "versionNo" DESC LIMIT 1', [TENANT, DASH_ID])).rows[0];
  let dashVersionNo = dashV?.versionNo;
  if (!dashVersionNo) {
    dashVersionNo = 1;
    const payload = {
      dashboardId: DASH_ID, code: 'DASH-OFFICE', name: 'Office Digital Twin Command Center',
      viewType: 'OFFICE_TWIN', sceneId: SCENE_ID, globalFilters: ['orgUnitId', 'timeWindow'], versionNo: 1, widgets,
    };
    await c.query(
      `INSERT INTO "DashboardVersion" (id,"tenantId","dashboardId","versionNo",payload,checksum,status,"publishedBy","publishedAt",note)
       VALUES ($1,$2,$3,1,$4,$5,'PUBLISHED',$6,now(),'seed:ioc reference slice')`,
      [`${DASH_ID}-v1`, TENANT, DASH_ID, JSON.stringify(payload), checksumOf(payload), ACTOR],
    );
  }
  await c.query(`UPDATE "DashboardDefinition" SET status='PUBLISHED', "activeVersionNo"=$2 WHERE id=$1`, [DASH_ID, dashVersionNo]);

  // 9) SYSTEM-ISOLATION marker twin (must NEVER be visible to tenant-xtech).
  await c.query(
    `INSERT INTO "TwinSite" (id,"tenantId",code,name,status,"createdBy","createdAt","updatedAt")
     VALUES ('ioc-site-isolation',$1,'MUST-NOT-LEAK-SITE','MUST_NOT_LEAK_IOC_SCENE','ACTIVE','seed',now(),now())
     ON CONFLICT ("tenantId",code) DO NOTHING`,
    [ISO_TENANT],
  );
  await c.query(
    `INSERT INTO "DashboardDefinition" (id,"tenantId",code,name,"viewType","globalFilters",widgets,status,revision,"createdBy","createdAt","updatedAt")
     VALUES ('ioc-dash-isolation',$1,'MUST-NOT-LEAK-DASH','MUST_NOT_LEAK_IOC_DASHBOARD','CUSTOM',ARRAY[]::text[],'[]'::jsonb,'DRAFT',0,'seed',now(),now())
     ON CONFLICT ("tenantId",code) DO NOTHING`,
    [ISO_TENANT],
  );
  await c.query(
    `INSERT INTO "DataLayerDefinition" (id,"tenantId",code,name,"sourceKey","entityKey",query,aggregation,"refreshPolicy","visualMapping",sensitivity,status,"createdBy","createdAt","updatedAt")
     VALUES ('ioc-dl-isolation',$1,'MUST-NOT-LEAK-DL','MUST_NOT_LEAK_PEOPLE_METRIC','xoffice-work','NativeWorkItem',
             '{"filters":[],"timeWindow":"LIVE","groupBy":["orgUnitId"]}'::jsonb,'{"op":"COUNT","field":null}'::jsonb,
             'MANUAL','{"mode":"CARD","thresholds":[]}'::jsonb,'AGGREGATE','ACTIVE','seed',now(),now())
     ON CONFLICT ("tenantId",code) DO NOTHING`,
    [ISO_TENANT],
  );

  await c.query('COMMIT');
  console.log('IOC TWIN SEED OK');
  console.log(`  site=${SITE_ID} floor=${FLOOR_ID}`);
  console.log(`  plan=${PLAN_ID} v${planVersionNo} (${geometry.zones.length} zones, meters)`);
  console.log(`  scene=${SCENE_ID} v${sceneVersionNo} (${ZONE_PLAN.length} org bindings → ${ZONE_PLAN.map((z) => z.org).join(',')})`);
  console.log(`  dataLayers=${DATA_LAYERS.map((d) => d.code).join(',')}`);
  console.log(`  dashboard=DASH-OFFICE v${dashVersionNo} (${widgets.length} widgets)`);
  console.log(`  isolation markers seeded into ${ISO_TENANT}`);
} catch (e) {
  await c.query('ROLLBACK');
  console.error('IOC TWIN SEED FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
