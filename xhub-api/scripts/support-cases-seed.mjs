// Product Customer Support seed (seed:support-cases, 2026-08-06) — 3 realistic
// X2 (PRD-X2, chung cư/condo operations) customer support cases, modeled on
// real support-group conversation patterns this company handles for X2
// (operational request, data-reconciliation check, documentation/usage
// question). NOT a verbatim transcript of any specific conversation — these
// are representative scenarios written for this seed, in the same shape.
// Linked to the existing T001 reference customer (CUS-T002, "Công ty Cổ phần
// Đầu tư Riverside" — already using XHub/X.Office/X2 per customers.seed.json)
// where a customer link makes sense. Idempotent: upsert-by (tenantId, code).
// Talks straight to Postgres under RLS bypass, mirrors xoffice-requests-seed.
// Run: npm run seed:support-cases
import 'dotenv/config';
import pg from 'pg';

const TENANT_ID = 'tenant-xtech';

const c = new pg.Client({ connectionString: process.env.XOFFICE_DATABASE_URL });
await c.connect();
let inserted = 0;
let skipped = 0;
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  const customerRow = await c.query(`SELECT id FROM "Customer" WHERE "tenantId" = $1 AND code = 'CUS-T002' LIMIT 1`, [TENANT_ID]);
  const customerId = customerRow.rows[0]?.id ?? null;

  const CASES = [
    {
      code: 'SUP-2026-0001',
      title: 'Đổi số hotline Ban Quản lý toà nhà',
      description:
        'BQL yêu cầu đổi số hotline hiển thị trên app cư dân X2 sang số mới của BQL (0987523330), thay số cũ đang cấu hình tạm. Đã gửi kèm link tài liệu vận hành (docs.x-tech.com.vn/van-hanh-toa-nha) để BQL tự đối chiếu bước cấu hình trước khi nhờ hỗ trợ đổi trực tiếp trên hệ thống.',
      productCode: 'PRD-X2',
      category: 'OPERATION_SUPPORT',
      channel: 'ZALO',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      requesterName: 'Ban Quản lý toà nhà',
      requesterContact: 'Nhóm Zalo MZK - NSG - PHẦN MỀM',
      customerId,
    },
    {
      code: 'SUP-2026-0002',
      title: 'Lệch số liệu thu/chi kỳ tháng 7 — mã căn MP7-008.08',
      description:
        'Đối soát báo cáo thu chi: tổng thu ghi nhận 11.854.784đ, tổng phát sinh đến kỳ T7 là 11.794.160đ → phải dư 60.624đ, nhưng phần mềm đang hiển thị còn nợ. Cần kiểm tra lại logic khớp thu/phát sinh cho căn MP7-008.08, xác nhận có phải lỗi tính phí kỳ hay lỗi ghi nhận thanh toán.',
      productCode: 'PRD-X2',
      category: 'DATA_FIX',
      channel: 'ZALO',
      priority: 'HIGH',
      status: 'TRIAGED',
      requesterName: 'Kế toán Ban Quản lý',
      requesterContact: 'Nhóm Zalo MZK - NSG - PHẦN MỀM',
      customerId,
    },
    {
      code: 'SUP-2026-0003',
      title: 'Hướng dẫn thao tác vận hành toà nhà trên X2',
      description:
        'BQL mới nhận bàn giao hỏi lại cách sử dụng phân hệ vận hành toà nhà (theo dõi thiết bị, lịch bảo trì) — đã trỏ tài liệu docs.x-tech.com.vn/van-hanh-toa-nha, cần xác nhận lại tài liệu còn khớp bản UI hiện tại không.',
      productCode: 'PRD-X2',
      category: 'USAGE_QUESTION',
      channel: 'ZALO',
      priority: 'LOW',
      status: 'NEW',
      requesterName: 'Ban Quản lý toà nhà',
      requesterContact: 'Nhóm Zalo MZK - NSG - PHẦN MỀM',
      customerId,
    },
  ];

  for (const s of CASES) {
    const res = await c.query(
      `INSERT INTO "SupportCase"
         (id, "tenantId", code, title, description, "productCode", "customerId",
          "requesterName", "requesterContact", channel, category, priority, status, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)
       ON CONFLICT ("tenantId", code) DO NOTHING`,
      [
        s.code, TENANT_ID, s.code, s.title, s.description, s.productCode, s.customerId,
        s.requesterName, s.requesterContact, s.channel, s.category, s.priority, s.status, new Date(),
      ],
    );
    if (res.rowCount > 0) {
      inserted++;
      await c.query(
        `INSERT INTO "SupportCaseEvent" (id, "tenantId", "supportCaseId", type, "actorId", data, "createdAt")
         VALUES ($1,$2,$3,'seeded',$4,$5::jsonb,$6)`,
        [`evt-${s.code}`, TENANT_ID, s.code, 'seed-script', JSON.stringify({ status: s.status, category: s.category }), new Date()],
      );
    } else {
      skipped++;
    }
  }

  await c.query('COMMIT');
  console.log(`support-cases seed OK | source=${CASES.length} inserted=${inserted} skipped(existing)=${skipped} customerLinked=${customerId ? 'yes' : 'no'}`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('support-cases seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
