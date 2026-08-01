// Records / Documents seed (Mục 8a) for a realistic live Documents screen.
// Idempotent: skips a document whose title already exists for the tenant, so it
// is safe to re-run. Does NOT wipe existing records. Server must be up on :4000.
// Run: npm run seed:records   (or: node scripts/records-seed.mjs)
import 'dotenv/config';

const BASE = process.env.XOFFICE_BASE || 'http://localhost:4000';
const H = { 'content-type': 'application/json', 'x-tenant-id': 'tenant-xtech', 'x-user-id': 'user-nam' };

const j = async (path, opts = {}) => {
  const r = await fetch(BASE + path, { headers: H, ...opts });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
};

// ~6 documents derived from the seed "documents" themes; a couple get a 2nd version.
const SEED = [
  {
    title: 'Biên bản họp kickoff FinERP Minh Phát',
    kind: 'MEETING_MINUTES',
    tags: ['bien-ban', 'minh-phat'],
    subjectType: 'Project',
    subjectId: 'project-finerp-minhphat',
    mimeType: 'text/plain',
    content: 'BIÊN BẢN HỌP KICKOFF\nDự án: FinERP Minh Phát\nThành phần: BĐH XTech, đại diện Minh Phát\nNội dung: thống nhất phạm vi, mốc bàn giao, kênh liên lạc.',
    versions: [
      'BIÊN BẢN HỌP KICKOFF (bản chỉnh sửa)\nDự án: FinERP Minh Phát\nBổ sung: chốt lịch demo và danh sách rủi ro ban đầu.',
    ],
  },
  {
    title: 'Báo giá FinERP Minh Phát v2',
    kind: 'QUOTE',
    tags: ['bao-gia', 'minh-phat'],
    subjectType: 'Customer',
    subjectId: 'customer-minhphat',
    mimeType: 'text/plain',
    content: 'BÁO GIÁ FinERP — Minh Phát\nHạng mục: license, triển khai, đào tạo.\nTổng: liên hệ. Hiệu lực 30 ngày.',
    versions: [
      'BÁO GIÁ FinERP — Minh Phát (v2)\nĐiều chỉnh: chiết khấu gói triển khai, thêm hạng mục bảo trì năm đầu.',
    ],
  },
  {
    title: 'Hợp đồng triển khai FinERP Minh Phát',
    kind: 'CONTRACT',
    tags: ['hop-dong', 'minh-phat'],
    subjectType: 'Customer',
    subjectId: 'customer-minhphat',
    mimeType: 'text/plain',
    content: 'HỢP ĐỒNG TRIỂN KHAI PHẦN MỀM\nBên A: Minh Phát — Bên B: XTech\nĐiều khoản: phạm vi, thanh toán theo mốc, bảo mật, nghiệm thu.',
  },
  {
    title: 'Đề xuất giải pháp FinERP',
    kind: 'PROPOSAL',
    tags: ['de-xuat', 'giai-phap'],
    subjectType: 'Project',
    subjectId: 'project-finerp-minhphat',
    mimeType: 'text/plain',
    content: 'ĐỀ XUẤT GIẢI PHÁP FinERP\nHiện trạng, kiến trúc đề xuất, lộ trình 3 giai đoạn, lợi ích kỳ vọng.',
  },
  {
    title: 'Tài liệu kỹ thuật kiến trúc hệ thống',
    kind: 'TECH_DOC',
    tags: ['ky-thuat', 'kien-truc'],
    subjectType: 'Project',
    subjectId: 'project-finerp-minhphat',
    mimeType: 'text/markdown',
    content: '# Kiến trúc hệ thống\n\n- BFF NestJS + RLS đa tenant\n- Web Next.js\n- Hàng đợi & webhook outbound\n- Lưu trữ tài liệu theo hash (dedup)',
  },
  {
    title: 'Tài liệu yêu cầu nghiệp vụ Minh Phát',
    kind: 'REQUIREMENT',
    tags: ['yeu-cau', 'minh-phat'],
    subjectType: 'Customer',
    subjectId: 'customer-minhphat',
    mimeType: 'text/plain',
    content: 'TÀI LIỆU YÊU CẦU NGHIỆP VỤ\nDanh sách yêu cầu chức năng và phi chức năng, mức ưu tiên MoSCoW.',
  },
];

async function main() {
  console.log('Records seed @ ' + BASE);
  const existing = await j('/api/records');
  const have = new Set((Array.isArray(existing.body) ? existing.body : []).map((d) => d.title));

  let created = 0;
  let skipped = 0;
  let versions = 0;
  for (const s of SEED) {
    if (have.has(s.title)) {
      console.log('  = skip (exists): ' + s.title);
      skipped++;
      continue;
    }
    const res = await j('/api/records', {
      method: 'POST',
      body: JSON.stringify({
        title: s.title, kind: s.kind, tags: s.tags,
        subjectType: s.subjectType, subjectId: s.subjectId,
        mimeType: s.mimeType, content: s.content,
      }),
    });
    if (res.status !== 200 && res.status !== 201) {
      console.error('  ✗ create failed: ' + s.title + ' (' + res.status + ')');
      continue;
    }
    const id = res.body?.document?.id;
    console.log('  + created: ' + s.title + ' (' + id + ')');
    created++;
    for (const vc of s.versions ?? []) {
      const av = await j(`/api/records/${id}/versions`, {
        method: 'POST',
        body: JSON.stringify({ content: vc, mimeType: s.mimeType }),
      });
      if (av.body?.version?.versionNo) {
        console.log('     ↳ version v' + av.body.version.versionNo);
        versions++;
      }
    }
  }

  console.log(`\nDone. created=${created}, versions=${versions}, skipped=${skipped}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
