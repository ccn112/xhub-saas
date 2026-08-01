// Solution Delivery seed (seed:engagements) — SaaS step 5. Loads a few demo
// Engagements for T001 (tenant-xtech) across the lifecycle: one at PROPOSAL, one
// at IMPLEMENTATION, and one at GO_LIVE ready-to-launch (targeting a T002-class
// real-estate demo prospect). No real personal data.
//
// Idempotent: insert-by (tenantId, code) via ON CONFLICT DO NOTHING — a 2nd run
// produces NO duplicates and does not wipe existing rows. Talks straight to
// Postgres under RLS bypass (app.bypass_rls='on'), mirroring tickets-seed. The
// server does NOT need to be running. Run: npm run seed:engagements
import 'dotenv/config';
import pg from 'pg';

const TENANT = 'tenant-xtech';
const OWNER = 'usr-delivery-mgr';

const ENGAGEMENTS = [
  {
    code: 'ENG-2026-0001',
    customerName: 'CÔNG TY MINH PHÁT — FinERP',
    industry: 'FINANCE',
    blueprintCode: 'BP-BASE-ENTERPRISE',
    seedPackCode: 'SP-BASE-ORG',
    stage: 'PROPOSAL',
    status: 'OPEN',
    value: 850000000,
    notes: 'Đề xuất triển khai FinERP — chờ khách duyệt báo giá.',
  },
  {
    code: 'ENG-2026-0002',
    customerName: 'TẬP ĐOÀN AN KHANG — HRM/Payroll',
    industry: 'MANUFACTURING',
    blueprintCode: 'BP-BASE-ENTERPRISE',
    seedPackCode: 'SP-BASE-ORG',
    stage: 'IMPLEMENTATION',
    status: 'WON',
    value: 1200000000,
    notes: 'Đang triển khai giai đoạn 1 — cấu hình tổ chức + phân quyền.',
  },
  {
    code: 'ENG-2026-0003',
    customerName: 'CHỦ ĐẦU TƯ BĐS DEMO (T002)',
    industry: 'REAL_ESTATE',
    prospectTenantNo: 2,
    targetTenantId: 'tenant-re-demo',
    blueprintCode: 'BP-RE-002',
    seedPackCode: 'SP-RE-DEMO',
    stage: 'GO_LIVE',
    status: 'LIVE',
    value: 2000000000,
    notes: 'Sẵn sàng khởi chạy tenant khách (Launch Factory) — dogfooding #12.',
  },
];

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
let inserted = 0;
let skipped = 0;
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  // Ensure the delivery owner person exists (shared identity directory).
  await c.query(
    `INSERT INTO "PersonProfile" (id, "tenantId", "fullName", email, status, "updatedAt")
     VALUES ($1,$2,$3,$4,'active',now())
     ON CONFLICT (id) DO NOTHING`,
    [OWNER, TENANT, 'Quản lý triển khai giải pháp', 'delivery.mgr@xtech.local'],
  );

  for (const e of ENGAGEMENTS) {
    const res = await c.query(
      `INSERT INTO "Engagement"
         (id, "tenantId", code, "customerName", "prospectTenantNo", "targetTenantId", industry,
          "blueprintCode", "seedPackCode", stage, status, "ownerId", value, notes, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),now())
       ON CONFLICT ("tenantId", code) DO NOTHING`,
      [
        e.code, TENANT, e.code, e.customerName, e.prospectTenantNo ?? null, e.targetTenantId ?? null,
        e.industry ?? null, e.blueprintCode ?? null, e.seedPackCode ?? null, e.stage, e.status, OWNER,
        e.value ?? null, e.notes ?? null,
      ],
    );
    if (res.rowCount > 0) {
      inserted++;
      await c.query(
        `INSERT INTO "EngagementEvent" (id, "tenantId", "engagementId", type, "actorId", data, "createdAt")
         VALUES ($1,$2,$3,'seeded',$4,$5::jsonb,now())`,
        [`eevt-${e.code}`, TENANT, e.code, OWNER, JSON.stringify({ stage: e.stage, status: e.status, code: e.code })],
      );
    } else {
      skipped++;
    }
  }

  await c.query('COMMIT');
  console.log(`engagements seed OK | source=${ENGAGEMENTS.length} inserted=${inserted} skipped(existing)=${skipped}`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('engagements seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
