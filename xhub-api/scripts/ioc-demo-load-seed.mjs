// XHub Enterprise IOC — "bản mô phỏng mẫu" load seed (seed:ioc-demo-load).
//
// WHY: a twin whose every zone reads "bình thường" looks dead. The owner asked
// to SEE the flow — so the T001 office template must show visibly DIFFERENT zone
// states: at least one OVERLOADED, one BUSY and one deliberately quiet.
//
// HOW (Constitution #1/#12 — no parallel business ledger): the numbers are NOT
// written into any Twin table. This seed only adds REAL `NativeWorkItem` rows
// owned by REAL people in the target org units; the IOC data layer then folds
// person → Position → OrgUnit exactly as it does in production, and the zone
// colour changes because the underlying WORK changed. Delete these items and the
// twin goes quiet again — which is the proof that the projection is live.
//
// weightedDemand (derived, ADR-0005) = weight ?? estimateMinutes/60 ??
//   {URGENT:8, HIGH:5, NORMAL:3, LOW:1}[priority]
// DL-WORKLOAD thresholds: <6 NORMAL · 6–12 GOOD · 12–20 BUSY · ≥20 OVERLOADED
//
// Idempotent (upsert by stable id), RLS bypass, server NOT required.
// Run: npm run seed:ioc-demo-load
import 'dotenv/config';
import pg from 'pg';

const TENANT = 'tenant-xtech';
const now = Date.now();
const d = (days) => new Date(now + days * 24 * 3600 * 1000);

// owner → the OrgUnit the fold will resolve (Position.holderPersonId).
// SALES  → pushed OVER 20  → OVERLOADED (đỏ)
// TECH   → pushed into 12–20 → BUSY (cam)
// HR     → intentionally untouched → stays quiet (xanh/blue)
const LOAD_PLAN = [
  { org: 'SALES', owner: 'usr-sales-head', n: 4, weight: 6, priority: 'URGENT', title: 'Chốt hợp đồng khách hàng lớn' },
  { org: 'SALES', owner: 'usr-sales-01', n: 3, weight: 5, priority: 'HIGH', title: 'Chuẩn bị hồ sơ thầu' },
  { org: 'TECH', owner: 'usr-tech-head', n: 3, weight: 4, priority: 'HIGH', title: 'Nâng cấp hạ tầng vận hành' },
  { org: 'TECH', owner: 'usr-infra', n: 1, weight: 3, priority: 'NORMAL', title: 'Rà soát giám sát hệ thống' },
  { org: 'SUPPORT', owner: 'usr-support-head', n: 2, weight: 4, priority: 'HIGH', title: 'Xử lý tồn đọng yêu cầu khách hàng' },
];

// ---- cross-department HANDOFFS (the flow layer's ONLY real source) ---------
//
// The flow lines on the command centre are NOT a twin table. An edge A→B exists
// because a REAL NativeWorkItem is OWNED by a position holder in unit A and
// ASSIGNED to a position holder in unit B — the exact same person→Position→
// OrgUnit fold the zone colours use. Delete these rows and the lines vanish.
//
// The chain below mirrors a normal B2B delivery process end to end (the same
// shape as the reference concept: Lead → Sales → Finance → Approval → Delivery
// → Support), but every node is a REAL OrgUnit of tenant-xtech.
//
// `overdue: true` sets dueAt in the PAST — a genuine overdue row so the alert
// feed and the on-time metric have real signal instead of an invented number.
const HANDOFF_PLAN = [
  { from: 'usr-solution-head', to: 'usr-sales-01', n: 3, title: 'Bàn giao cơ hội từ tư vấn giải pháp' },
  { from: 'usr-sales-head', to: 'usr-accountant', n: 4, title: 'Đề nghị kiểm tra công nợ & báo giá' },
  { from: 'usr-cfo', to: 'usr-ceo', n: 3, title: 'Trình duyệt hợp đồng vượt hạn mức', overdue: true },
  { from: 'usr-ceo', to: 'usr-delivery-head', n: 3, title: 'Chuyển triển khai sau phê duyệt' },
  { from: 'usr-delivery-01', to: 'usr-support-head', n: 3, title: 'Bàn giao vận hành cho bộ phận hỗ trợ' },
  { from: 'usr-support-head', to: 'usr-infra', n: 2, title: 'Chuyển lỗi kỹ thuật sang Công nghệ', overdue: true },
  { from: 'usr-hr-head', to: 'usr-ceo', n: 2, title: 'Trình duyệt kế hoạch tuyển dụng' },
];

const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  // Refuse to seed against people who are not actually position holders — an
  // item owned by a non-holder folds to UNASSIGNED and would prove nothing.
  const holders = new Set(
    (await c.query('SELECT DISTINCT "holderPersonId" FROM "Position" WHERE "tenantId"=$1 AND "holderPersonId" IS NOT NULL', [TENANT])).rows.map((r) => r.holderPersonId),
  );
  const missing = [...new Set([...LOAD_PLAN.map((p) => p.owner), ...HANDOFF_PLAN.flatMap((p) => [p.from, p.to])])].filter((o) => !holders.has(o));
  if (missing.length) throw new Error(`not a position holder in ${TENANT}: ${missing.join(', ')} — run the identity seed first`);

  let n = 0;
  for (const p of LOAD_PLAN) {
    for (let i = 1; i <= p.n; i++) {
      const id = `wi-ioc-demo-${p.org.toLowerCase()}-${p.owner.replace('usr-', '')}-${i}`;
      await c.query(
        `INSERT INTO "NativeWorkItem"
           (id,"tenantId","projectId","parentId","wbsCode",type,title,description,status,priority,
            "ownerId","assigneeIds","plannedStart","dueAt","actualStart","completedAt",
            "progressPercent",weight,tags,dimensions,"createdBy","createdAt","updatedAt")
         VALUES ($1,$2,NULL,NULL,NULL,'TASK',$3,$4,'IN_PROGRESS',$5,$6,ARRAY[$6]::text[],now(),$7,now(),NULL,$8,$9,
                 ARRAY['ioc-demo','ban-sao-so']::text[],'{}'::jsonb,'seed:ioc-demo-load',now(),now())
         ON CONFLICT (id) DO UPDATE SET
           title=EXCLUDED.title, status=EXCLUDED.status, priority=EXCLUDED.priority,
           "ownerId"=EXCLUDED."ownerId", "assigneeIds"=EXCLUDED."assigneeIds",
           weight=EXCLUDED.weight, tags=EXCLUDED.tags, "updatedAt"=now()`,
        [
          id, TENANT, `${p.title} #${i}`,
          'Dữ liệu mô phỏng cho bản sao số — công việc THẬT trong Work v2, không phải số ghi thẳng vào bảng twin.',
          p.priority, p.owner, d(3 + i), 20 + i * 5, p.weight,
        ],
      );
      n++;
    }
  }

  // Cross-department handoffs: ownerId in unit A, assigneeIds = [someone in B].
  let h = 0;
  for (const p of HANDOFF_PLAN) {
    for (let i = 1; i <= p.n; i++) {
      const id = `wi-ioc-flow-${p.from.replace('usr-', '')}-${p.to.replace('usr-', '')}-${i}`;
      await c.query(
        `INSERT INTO "NativeWorkItem"
           (id,"tenantId","projectId","parentId","wbsCode",type,title,description,status,priority,
            "ownerId","assigneeIds","plannedStart","dueAt","actualStart","completedAt",
            "progressPercent",weight,tags,dimensions,"createdBy","createdAt","updatedAt")
         VALUES ($1,$2,NULL,NULL,NULL,'TASK',$3,$4,'IN_PROGRESS','NORMAL',$5,ARRAY[$6]::text[],now(),$7,now(),NULL,30,1,
                 ARRAY['ioc-demo','ban-giao-lien-phong-ban']::text[],'{}'::jsonb,'seed:ioc-demo-load',now(),now())
         ON CONFLICT (id) DO UPDATE SET
           title=EXCLUDED.title, status=EXCLUDED.status, "ownerId"=EXCLUDED."ownerId",
           "assigneeIds"=EXCLUDED."assigneeIds", "dueAt"=EXCLUDED."dueAt",
           weight=EXCLUDED.weight, tags=EXCLUDED.tags, "updatedAt"=now()`,
        [
          id, TENANT, `${p.title} #${i}`,
          'Bàn giao liên phòng ban THẬT trong Work v2 — nguồn duy nhất của các đường luồng trên bản sao số.',
          p.from, p.to, p.overdue ? d(-(2 + i)) : d(5 + i),
        ],
      );
      h++;
    }
  }

  // Report the resulting per-zone load exactly the way the data layer computes it.
  const orgOf = new Map();
  for (const r of (await c.query('SELECT "holderPersonId","orgUnitId","isHead" FROM "Position" WHERE "tenantId"=$1 AND "holderPersonId" IS NOT NULL', [TENANT])).rows) {
    if (!orgOf.has(r.holderPersonId) || r.isHead) orgOf.set(r.holderPersonId, r.orgUnitId);
  }
  const codeOf = new Map((await c.query('SELECT id, code FROM "OrgUnit" WHERE "tenantId"=$1', [TENANT])).rows.map((r) => [r.id, r.code]));
  const items = (await c.query(
    `SELECT "ownerId","assigneeIds",weight,"estimateMinutes",priority FROM "NativeWorkItem"
      WHERE "tenantId"=$1 AND status NOT IN ('DONE','CANCELLED')`, [TENANT])).rows;
  const wd = (it) => (it.weight != null ? Number(it.weight) : it.estimateMinutes != null ? it.estimateMinutes / 60 : ({ URGENT: 8, HIGH: 5, NORMAL: 3, LOW: 1 }[it.priority] ?? 3));
  const totals = new Map();
  for (const it of items) {
    const person = it.ownerId ?? it.assigneeIds?.[0] ?? null;
    const key = (person && codeOf.get(orgOf.get(person))) || 'UNASSIGNED';
    totals.set(key, (totals.get(key) ?? 0) + wd(it));
  }
  const state = (v) => (v >= 20 ? 'OVERLOADED' : v >= 12 ? 'BUSY' : v >= 6 ? 'GOOD' : 'NORMAL');

  await c.query('COMMIT');
  console.log('IOC DEMO LOAD SEED OK');
  console.log(`  ${n} load + ${h} cross-department handoff NativeWorkItem rows upserted into ${TENANT} (tag: ioc-demo)`);
  console.log('  handoff edges (owner unit → assignee unit, drives the flow lines):');
  for (const p of HANDOFF_PLAN) {
    console.log(`    ${(codeOf.get(orgOf.get(p.from)) ?? '?').padEnd(10)} → ${(codeOf.get(orgOf.get(p.to)) ?? '?').padEnd(10)} ${String(p.n).padStart(2)}${p.overdue ? '  (có việc quá hạn)' : ''}`);
  }
  console.log('  projected zone load (DL-WORKLOAD = SUM weightedDemand, live fold person→Position→OrgUnit):');
  for (const [code, v] of [...totals.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${code.padEnd(12)} ${String(Math.round(v * 10) / 10).padStart(6)}  → ${state(v)}`);
  }
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('IOC DEMO LOAD SEED FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
