// Go-Live checklist TEMPLATE seeder (seed:golive-template). Seeds ONE generic
// PUBLISHED GoLiveChecklistTemplate (SHARED / platform-plane, no RLS) matching
// the plan's sequential step list. Idempotent: upsert-by (code, version).
// Run: npm run seed:golive-template
import 'dotenv/config';
import { createHash } from 'node:crypto';
import pg from 'pg';

const CODE = 'GOLIVE-GENERIC';
const VERSION = 1;

// Sequential go-live steps (per TENANT_LIFECYCLE_DEMO_GOLIVE_PLAN §3).
const STEPS = [
  { order: 1, key: 'org-structure', title: 'Chuẩn hoá cơ cấu tổ chức',
    guidance: 'Rà soát và chuẩn hoá sơ đồ phòng ban/đơn vị theo thực tế doanh nghiệp.',
    suggestedRole: 'HR_MANAGER', templateRef: 'template/org-structure.xlsx', required: true },
  { order: 2, key: 'real-people', title: 'Nạp nhân sự thật',
    guidance: 'Import danh sách nhân sự thật (thay dữ liệu demo), gán vào vị trí.',
    suggestedRole: 'HR_MANAGER', templateRef: 'template/nhan-su.xlsx', required: true },
  { order: 3, key: 'roles-permissions', title: 'Cấu hình vai trò / quyền',
    guidance: 'Thiết lập ma trận vai trò và phân quyền cho từng nhóm người dùng.',
    suggestedRole: 'ADMIN', templateRef: 'template/ma-tran-quyen.xlsx', required: true },
  { order: 4, key: 'approval-flows', title: 'Thiết lập quy trình duyệt',
    guidance: 'Cấu hình các luồng phê duyệt (đề xuất, chỉ đạo, ticket…) theo thực tế.',
    suggestedRole: 'ADMIN', required: true },
  { order: 5, key: 'master-catalog', title: 'Nhập danh mục gốc',
    guidance: 'Nhập danh mục/dữ liệu gốc (khách hàng, sản phẩm, tài nguyên…).',
    suggestedRole: 'OPS', templateRef: 'template/danh-muc.xlsx', required: false },
  { order: 6, key: 'backup-config', title: 'Cấu hình backup',
    guidance: 'Kiểm tra lịch backup + retention cho tenant trước khi chạy chính thức.',
    suggestedRole: 'ADMIN', required: true },
  { order: 7, key: 'uat', title: 'Nghiệm thu UAT',
    guidance: 'Chạy nghiệm thu người dùng cuối trên các nghiệp vụ chính.',
    suggestedRole: 'PROJECT_OWNER', required: true },
  { order: 8, key: 'confirm-clear-demo', title: 'Xác nhận xoá dữ liệu demo',
    guidance: 'Xác nhận đồng ý xoá toàn bộ dữ liệu nghiệp vụ demo để bắt đầu chính thức.',
    suggestedRole: 'PROJECT_OWNER', required: true },
  { order: 9, key: 'activate-live', title: 'Kích hoạt LIVE',
    guidance: 'Chuyển tenant sang chế độ chính thức (một chiều).',
    suggestedRole: 'PLATFORM_OPERATOR', required: true },
];

const checksum = createHash('sha256')
  .update(JSON.stringify({ code: CODE, version: VERSION, steps: STEPS }))
  .digest('hex');

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");
  await c.query(
    `INSERT INTO "GoLiveChecklistTemplate"
       (id, code, name, version, status, scope, "blueprintCode", steps, checksum, "publishedAt", "createdAt")
     VALUES ($1,$2,$3,$4,'PUBLISHED','GENERIC',NULL,$5,$6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (code, version) DO UPDATE SET
       name=EXCLUDED.name, status='PUBLISHED', scope='GENERIC',
       steps=EXCLUDED.steps, checksum=EXCLUDED.checksum, "publishedAt"=CURRENT_TIMESTAMP`,
    [`golive-tpl-${CODE}-v${VERSION}`, CODE, 'Go-Live chuẩn (generic)', VERSION, JSON.stringify(STEPS), checksum],
  );
  await c.query('COMMIT');
  const n = await c.query(`SELECT COUNT(*)::int AS n FROM "GoLiveChecklistTemplate" WHERE status='PUBLISHED'`);
  console.log(`golive-template seed OK | ${CODE}@v${VERSION} (${STEPS.length} steps) | published templates=${n.rows[0].n}`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('golive-template seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
