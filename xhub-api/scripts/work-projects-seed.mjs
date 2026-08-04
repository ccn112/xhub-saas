// Work projects seed (seed:work-projects) — X.Office Work v2 W2. Seeds 3
// ExecutionProjects for tenant-xtech, attaches a subset of the W1 work items into
// a WBS (a parent with weighted children), adds FS/SS/FF/SF + one milestone
// dependency, captures a baseline v1, assigns project roles, and adds ONE
// SUMMARY CoordinationShare to a non-member (so the coordination-Gantt test has
// data). Optionally links one Engagement to an IMPLEMENTATION project.
//
// Idempotent: upsert-by stable id. Talks straight to Postgres under RLS bypass;
// the server does NOT need to be running. Run: npm run seed:work-projects
import 'dotenv/config';
import pg from 'pg';

const TENANT = 'tenant-xtech';
const now = Date.now();
const d = (days) => new Date(now + days * 24 * 3600 * 1000);
const OWNER = 'usr-cfo';

const PROJECTS = [
  { id: 'ep-seed-internal', code: 'EP-INT-001', name: 'Nền tảng X.Office nội bộ', kind: 'INTERNAL', status: 'ACTIVE', method: 'TASK_WEIGHTED', pm: 'usr-cfo', sponsor: 'usr-ceo', pStart: d(-20), pFinish: d(30), fFinish: d(34) },
  { id: 'ep-seed-impl', code: 'EP-IMP-001', name: 'Triển khai FinERP — Minh Phát', kind: 'IMPLEMENTATION', status: 'ACTIVE', method: 'DELIVERABLE_WEIGHTED', pm: 'usr-delivery-mgr', sponsor: 'usr-ceo', pStart: d(-10), pFinish: d(45), fFinish: d(52) },
  { id: 'ep-seed-ops', code: 'EP-OPS-001', name: 'Vận hành hạ tầng SaaS', kind: 'OPERATIONS', status: 'PLANNED', method: 'MILESTONE_WEIGHTED', pm: 'usr-tech-head', sponsor: 'usr-cfo', pStart: d(0), pFinish: d(60), fFinish: d(60) },
];

// Attach existing W1 seed items into EP-INT-001 as a WBS (parent + weighted kids
// + a milestone). These ids come from scripts/work-items-seed.mjs.
const WBS = {
  projectId: 'ep-seed-internal',
  parent: 'wi-seed-parent',
  children: [
    { id: 'wi-seed-child-1', weight: 2, wbs: '1.1' },
    { id: 'wi-seed-child-2', weight: 1, wbs: '1.2' },
  ],
  milestone: 'wi-seed-003',
  extra: ['wi-seed-001', 'wi-seed-004'],
};

const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  for (const p of PROJECTS) {
    await c.query(
      `INSERT INTO "ExecutionProject"
         (id,"tenantId",code,name,"projectKind",status,health,"progressMethod","progressPercent",
          "plannedStart","plannedFinish","forecastFinish","ownerId","projectManagerId","sponsorId",
          tags,dimensions,"createdBy","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,'UNKNOWN',$7,0,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,now(),now())
       ON CONFLICT (id) DO UPDATE SET
         name=EXCLUDED.name,"projectKind"=EXCLUDED."projectKind",status=EXCLUDED.status,
         "progressMethod"=EXCLUDED."progressMethod","plannedStart"=EXCLUDED."plannedStart",
         "plannedFinish"=EXCLUDED."plannedFinish","forecastFinish"=EXCLUDED."forecastFinish",
         "projectManagerId"=EXCLUDED."projectManagerId","sponsorId"=EXCLUDED."sponsorId","updatedAt"=now()`,
      [p.id, TENANT, p.code, p.name, p.kind, p.status, p.method, p.pStart, p.pFinish, p.fFinish, OWNER, p.pm, p.sponsor, ['w2', p.kind.toLowerCase()], JSON.stringify({ bo_phan: 'PMO' }), OWNER],
    );
  }

  // Attach WBS items into EP-INT-001.
  const attach = [
    ...WBS.children.map((k) => ({ id: k.id, parent: WBS.parent, wbs: k.wbs, weight: k.weight })),
    { id: WBS.parent, parent: null, wbs: '1', weight: null },
    { id: WBS.milestone, parent: null, wbs: '2', weight: null },
    ...WBS.extra.map((id, i) => ({ id, parent: null, wbs: `${3 + i}`, weight: 1 })),
  ];
  for (const a of attach) {
    await c.query(
      `UPDATE "NativeWorkItem" SET "projectId"=$1,"parentId"=$2,"wbsCode"=$3,"weight"=COALESCE($4,"weight"),"updatedAt"=now()
       WHERE id=$5 AND "tenantId"=$6`,
      [WBS.projectId, a.parent, a.wbs, a.weight, a.id, TENANT],
    );
  }

  // Dependencies (FS/SS/FF/SF + one to the milestone).
  const deps = [
    { id: 'wd-seed-1', pre: 'wi-seed-child-1', suc: 'wi-seed-child-2', type: 'FS' },
    { id: 'wd-seed-2', pre: 'wi-seed-001', suc: 'wi-seed-child-1', type: 'SS' },
    { id: 'wd-seed-3', pre: 'wi-seed-child-2', suc: 'wi-seed-003', type: 'FS' }, // → milestone
    { id: 'wd-seed-4', pre: 'wi-seed-004', suc: 'wi-seed-003', type: 'FF' },
  ];
  for (const dep of deps) {
    await c.query(
      `INSERT INTO "WorkDependency" (id,"tenantId","predecessorId","successorId",type,"lagMinutes","createdBy","createdAt")
       VALUES ($1,$2,$3,$4,$5,0,$6,now())
       ON CONFLICT ("tenantId","predecessorId","successorId",type) DO NOTHING`,
      [dep.id, TENANT, dep.pre, dep.suc, dep.type, OWNER],
    );
  }

  // Baseline v1 for EP-INT-001 (immutable snapshot of the attached items).
  await c.query(
    `INSERT INTO "ProjectBaseline" (id,"tenantId","projectId",version,label,note,"createdBy","createdAt")
     VALUES ('pb-seed-int-v1',$1,'ep-seed-internal',1,'v1','seed baseline',$2,now())
     ON CONFLICT ("tenantId","projectId",version) DO NOTHING`,
    [TENANT, OWNER],
  );
  const bItems = await c.query(`SELECT id,"plannedStart","dueAt",weight,"progressPercent" FROM "NativeWorkItem" WHERE "tenantId"=$1 AND "projectId"='ep-seed-internal'`, [TENANT]);
  for (const bi of bItems.rows) {
    await c.query(
      `INSERT INTO "BaselineItem" (id,"tenantId","baselineId","workItemId","plannedStart","dueAt",weight,"progressPercent")
       VALUES ($1,$2,'pb-seed-int-v1',$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO NOTHING`,
      [`bi-seed-${bi.id}`, TENANT, bi.id, bi.plannedStart, bi.dueAt, bi.weight, bi.progressPercent],
    );
  }
  await c.query(`UPDATE "ExecutionProject" SET "currentBaselineVersion"=1 WHERE id='ep-seed-internal' AND "tenantId"=$1`, [TENANT]);

  // Project roles.
  const roles = [
    { id: 'pra-seed-pm', proj: 'ep-seed-internal', st: 'USER', sid: 'usr-cfo', role: 'PROJECT_MANAGER', tier: 'FULL' },
    { id: 'pra-seed-sponsor', proj: 'ep-seed-internal', st: 'USER', sid: 'usr-ceo', role: 'SPONSOR', tier: 'FULL' },
    { id: 'pra-seed-member', proj: 'ep-seed-internal', st: 'USER', sid: 'usr-delivery-mgr', role: 'MEMBER', tier: 'FULL' },
    { id: 'pra-seed-observer', proj: 'ep-seed-internal', st: 'USER', sid: 'usr-hr-head', role: 'OBSERVER', tier: 'SUMMARY' },
  ];
  for (const r of roles) {
    await c.query(
      `INSERT INTO "ProjectRoleAssignment" (id,"tenantId","projectId","subjectType","subjectId",role,"visibilityTier","assignmentSnapshot","createdBy","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,now())
       ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role,"visibilityTier"=EXCLUDED."visibilityTier"`,
      [r.id, TENANT, r.proj, r.st, r.sid, r.role, r.tier, JSON.stringify({ via: 'seed' }), OWNER],
    );
  }

  // ONE SUMMARY CoordinationShare to a NON-MEMBER (usr-sales-head) so the
  // coordination-Gantt read has a cross-team viewer to serve.
  await c.query(
    `INSERT INTO "CoordinationShare" (id,"tenantId",scope,"scopeId","audienceType","audienceId",tier,"createdBy","createdAt")
     VALUES ('cs-seed-1',$1,'PROJECT','ep-seed-internal','USER','usr-sales-head','SUMMARY',$2,now())
     ON CONFLICT (id) DO NOTHING`,
    [TENANT, OWNER],
  );

  // Optionally link one Engagement to the IMPLEMENTATION project (reuse PM engine).
  await c.query(`UPDATE "Engagement" SET "executionProjectId"='ep-seed-impl' WHERE "tenantId"=$1 AND "executionProjectId" IS NULL AND id IN (SELECT id FROM "Engagement" WHERE "tenantId"=$1 ORDER BY "createdAt" ASC LIMIT 1)`, [TENANT]);

  await c.query('COMMIT');
  console.log(`work-projects seed OK | tenant=${TENANT} projects=${PROJECTS.length} deps=${deps.length} baseline=v1 roles=${roles.length} share=1`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('work-projects seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
