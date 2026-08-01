// Work items seed (seed:work-items) — X.Office Work v2 W1. Seeds the WorkDimension
// catalog + ~15 NativeWorkItems for tenant-xtech with varied type/status/priority
// + tags + dimension values (so stats/filter are demoable), a parent/child pair,
// and one owner/assignee split for the visibility test.
//
// Idempotent: upsert-by stable id (ON CONFLICT DO UPDATE). Talks straight to
// Postgres under RLS bypass (app.bypass_rls='on'); the server does NOT need to be
// running. Run: npm run seed:work-items
import 'dotenv/config';
import pg from 'pg';

const TENANT = 'tenant-xtech';
const now = Date.now();
const d = (offsetDays) => new Date(now + offsetDays * 24 * 3600 * 1000);

const DIMENSIONS = [
  { key: 'loai_viec', label: 'Loại việc', values: [{ value: 'BUG', label: 'Lỗi' }, { value: 'FEATURE', label: 'Tính năng' }, { value: 'CHORE', label: 'Việc vặt' }] },
  { key: 'giai_doan', label: 'Giai đoạn', values: [{ value: 'PLAN', label: 'Kế hoạch' }, { value: 'BUILD', label: 'Thực thi' }, { value: 'UAT', label: 'Kiểm thử' }] },
  { key: 'nhom_chi_phi', label: 'Nhóm chi phí', values: [{ value: 'CAPEX', label: 'CAPEX' }, { value: 'OPEX', label: 'OPEX' }] },
  { key: 'bo_phan', label: 'Bộ phận', values: [{ value: 'QA', label: 'QA' }, { value: 'DEV', label: 'Dev' }, { value: 'PMO', label: 'PMO' }] },
];

// createdBy/owner: usr-cfo is the demo admin (user-nam → usr-cfo). Assignees are
// seeded person/user ids from the identity org seed.
const OWNER = 'usr-cfo';
const items = [
  { id: 'wi-seed-001', type: 'TASK', title: 'Chuẩn hoá tài liệu kiến trúc W1', status: 'IN_PROGRESS', priority: 'HIGH', progress: 40, tags: ['w1', 'kien-truc'], dim: { loai_viec: 'FEATURE', giai_doan: 'BUILD', nhom_chi_phi: 'CAPEX', bo_phan: 'DEV' }, owner: OWNER, assignees: ['usr-cfo'] },
  { id: 'wi-seed-002', type: 'TASK', title: 'Sửa lỗi phân trang danh sách việc', status: 'TODO', priority: 'URGENT', progress: 0, tags: ['bug', 'ui'], dim: { loai_viec: 'BUG', giai_doan: 'BUILD', nhom_chi_phi: 'OPEX', bo_phan: 'DEV' }, owner: OWNER, assignees: ['usr-cfo'] },
  { id: 'wi-seed-003', type: 'MILESTONE', title: 'Mốc: Hoàn tất Native Work Core', status: 'TODO', priority: 'HIGH', progress: 0, tags: ['milestone', 'w1'], dim: { giai_doan: 'BUILD', bo_phan: 'PMO' }, plannedStart: d(0), dueAt: d(14), owner: OWNER, assignees: [] },
  { id: 'wi-seed-004', type: 'DELIVERABLE', title: 'Bàn giao API /api/work/items', status: 'REVIEW', priority: 'NORMAL', progress: 80, tags: ['api', 'w1'], dim: { loai_viec: 'FEATURE', giai_doan: 'UAT', nhom_chi_phi: 'CAPEX', bo_phan: 'DEV' }, owner: OWNER, assignees: ['usr-cfo'] },
  { id: 'wi-seed-005', type: 'TASK', title: 'Viết bộ smoke work-item', status: 'DONE', priority: 'NORMAL', progress: 100, tags: ['test', 'w1'], dim: { loai_viec: 'CHORE', giai_doan: 'UAT', nhom_chi_phi: 'OPEX', bo_phan: 'QA' }, owner: OWNER, assignees: ['usr-cfo'], completedAt: d(-1) },
  { id: 'wi-seed-006', type: 'TASK', title: 'Kiểm thử RLS bảng công việc', status: 'IN_PROGRESS', priority: 'HIGH', progress: 55, tags: ['test', 'rls'], dim: { loai_viec: 'CHORE', giai_doan: 'UAT', nhom_chi_phi: 'OPEX', bo_phan: 'QA' }, owner: OWNER, assignees: ['usr-cfo'] },
  { id: 'wi-seed-007', type: 'ACTION', title: 'Rà soát quyền work.view.summary', status: 'BACKLOG', priority: 'LOW', progress: 0, tags: ['security'], dim: { loai_viec: 'CHORE', giai_doan: 'PLAN', bo_phan: 'PMO' }, owner: OWNER, assignees: [] },
  { id: 'wi-seed-008', type: 'TASK', title: 'Thiết kế màn Việc của tôi', status: 'IN_PROGRESS', priority: 'NORMAL', progress: 30, tags: ['ui', 'w1'], dim: { loai_viec: 'FEATURE', giai_doan: 'BUILD', nhom_chi_phi: 'CAPEX', bo_phan: 'DEV' }, owner: OWNER, assignees: ['usr-cfo'] },
  { id: 'wi-seed-009', type: 'TASK', title: 'Chuẩn hoá nav workspace Công việc', status: 'TODO', priority: 'NORMAL', progress: 0, tags: ['nav'], dim: { loai_viec: 'CHORE', giai_doan: 'PLAN', bo_phan: 'PMO' }, owner: OWNER, assignees: [] },
  { id: 'wi-seed-010', type: 'FOLLOW_UP', title: 'Theo dõi phản hồi owner về Gantt', status: 'BLOCKED', priority: 'HIGH', progress: 10, tags: ['gantt', 'w3'], dim: { giai_doan: 'PLAN', bo_phan: 'PMO' }, owner: OWNER, assignees: ['usr-cfo'] },
  // Parent/child pair (WBS).
  { id: 'wi-seed-parent', type: 'TASK', title: 'Epic: Trải nghiệm quản lý công việc', status: 'IN_PROGRESS', priority: 'HIGH', progress: 25, wbsCode: '1', tags: ['epic', 'w1'], dim: { loai_viec: 'FEATURE', giai_doan: 'BUILD', nhom_chi_phi: 'CAPEX', bo_phan: 'DEV' }, owner: OWNER, assignees: ['usr-cfo'] },
  { id: 'wi-seed-child-1', type: 'SUBTASK', title: 'Con: List + filter', status: 'IN_PROGRESS', priority: 'NORMAL', progress: 50, wbsCode: '1.1', parentId: 'wi-seed-parent', tags: ['ui'], dim: { loai_viec: 'FEATURE', giai_doan: 'BUILD', bo_phan: 'DEV' }, owner: OWNER, assignees: ['usr-cfo'] },
  { id: 'wi-seed-child-2', type: 'SUBTASK', title: 'Con: Chi tiết + timeline', status: 'TODO', priority: 'NORMAL', progress: 0, wbsCode: '1.2', parentId: 'wi-seed-parent', tags: ['ui'], dim: { loai_viec: 'FEATURE', giai_doan: 'BUILD', bo_phan: 'DEV' }, owner: OWNER, assignees: [] },
  // Owner/assignee split for the visibility demo: owned by a different person,
  // assigned to another — so a third viewer only gets SUMMARY.
  { id: 'wi-seed-coord', type: 'TASK', title: 'Việc phối hợp liên phòng (coordination)', status: 'IN_PROGRESS', priority: 'HIGH', progress: 60, tags: ['coordination', 'cross-team'], dim: { loai_viec: 'FEATURE', giai_doan: 'BUILD', nhom_chi_phi: 'CAPEX', bo_phan: 'PMO' }, owner: 'usr-ceo', assignees: ['usr-delivery-mgr'], description: 'Chi tiết nội bộ chỉ owner/assignee thấy.' },
  { id: 'wi-seed-015', type: 'TASK', title: 'Cập nhật runbook seed/test work-item', status: 'DONE', priority: 'LOW', progress: 100, tags: ['docs'], dim: { loai_viec: 'CHORE', giai_doan: 'UAT', nhom_chi_phi: 'OPEX', bo_phan: 'PMO' }, owner: OWNER, assignees: ['usr-cfo'], completedAt: d(-2) },
];

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
let dims = 0;
let inserted = 0;
try {
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.bypass_rls','on',true)");

  for (const dim of DIMENSIONS) {
    await c.query(
      `INSERT INTO "WorkDimension" (id, "tenantId", key, label, "allowedValues", active, "sortOrder")
       VALUES ($1,$2,$3,$4,$5::jsonb,true,$6)
       ON CONFLICT ("tenantId", key)
       DO UPDATE SET label=EXCLUDED.label, "allowedValues"=EXCLUDED."allowedValues"`,
      [`wd-${dim.key}`, TENANT, dim.key, dim.label, JSON.stringify(dim.values), dims],
    );
    dims++;
  }

  for (const it of items) {
    const res = await c.query(
      `INSERT INTO "NativeWorkItem"
         (id, "tenantId", "projectId", "parentId", "wbsCode", type, title, description, status, priority,
          "ownerId", "assigneeIds", "plannedStart", "dueAt", "actualStart", "completedAt",
          "progressPercent", tags, dimensions, "createdBy", "createdAt", "updatedAt")
       VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,now(),now())
       ON CONFLICT (id) DO UPDATE SET
         type=EXCLUDED.type, title=EXCLUDED.title, description=EXCLUDED.description, status=EXCLUDED.status,
         priority=EXCLUDED.priority, "ownerId"=EXCLUDED."ownerId", "assigneeIds"=EXCLUDED."assigneeIds",
         "progressPercent"=EXCLUDED."progressPercent", tags=EXCLUDED.tags, dimensions=EXCLUDED.dimensions,
         "parentId"=EXCLUDED."parentId", "wbsCode"=EXCLUDED."wbsCode", "updatedAt"=now()`,
      [
        it.id, TENANT, it.parentId ?? null, it.wbsCode ?? null, it.type, it.title, it.description ?? null,
        it.status, it.priority, it.owner, it.assignees ?? [], it.plannedStart ?? null, it.dueAt ?? null,
        it.status === 'IN_PROGRESS' || it.status === 'REVIEW' || it.status === 'DONE' ? d(-3) : null,
        it.completedAt ?? null, it.progress ?? 0, it.tags ?? [], JSON.stringify(it.dim ?? {}), it.createdBy ?? OWNER,
      ],
    );
    if (res.rowCount > 0) inserted++;
  }

  await c.query('COMMIT');
  console.log(`work-items seed OK | tenant=${TENANT} dimensions=${dims} workItems=${items.length} (upserted)`);
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('work-items seed FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
