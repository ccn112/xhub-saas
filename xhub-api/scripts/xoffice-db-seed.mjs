// Idempotent X.Office DB seeder (standalone). Mirrors XofficeService.seedDatabase.
// Usage: node scripts/xoffice-db-seed.mjs
//
// RLS: this seeds MULTIPLE tenants, so the whole body runs inside ONE
// transaction with `app.bypass_rls='on'` (SET LOCAL). Without it, FORCE RLS
// would hide/deny every row for the owner role and the seed would write nothing.
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'seed-data', 'xoffice');
const read = (f) => JSON.parse(readFileSync(join(dir, f), 'utf8'));

const STOP_TYPES = new Set(['approval', 'humanTask']);
const tenantId = (slug) => `tenant-${slug}`;

function canonical(obj) {
  const sort = (v) =>
    Array.isArray(v) ? v.map(sort)
      : v && typeof v === 'object'
        ? Object.keys(v).sort().reduce((a, k) => ((a[k] = sort(v[k])), a), {})
        : v;
  return JSON.stringify(sort(obj));
}
const checksumOf = (def) =>
  createHash('sha256').update(canonical(def)).digest('hex').slice(0, 16);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const manifest = read('manifest.json');
let clockBase = new Date(manifest.canonicalNow).getTime();
let tick = 0;
const seedNow = () => new Date(clockBase + tick++ * 60_000);

const defs = read('workflow-definitions.json');

await prisma.$transaction(
  async (db) => {
    // Bypass RLS for the whole multi-tenant seed transaction.
    await db.$executeRawUnsafe("SELECT set_config('app.bypass_rls', 'on', true)");

    // Tenants
    const slugs = new Set(['xtech']);
    for (const d of defs) slugs.add(d.metadata.tenantSlug);
    for (const slug of slugs) {
      const id = tenantId(slug);
      const name = slug === 'xtech' ? 'XTech' : slug;
      await db.tenant.upsert({ where: { id }, update: { slug, name }, create: { id, slug, name } });
    }

    // Workflows + v1
    for (const d of defs) {
      const slug = d.metadata.tenantSlug;
      const workflowId = `wf-${slug}-${d.metadata.code}`;
      await db.workflow.upsert({
        where: { id: workflowId },
        update: {
          name: d.metadata.name,
          description: d.metadata.description ?? null,
          ownerRoleCode: d.metadata.ownerRoleCode ?? null,
          workingDefinition: d,
          schemaVersion: d.schemaVersion ?? '1.0',
        },
        create: {
          id: workflowId,
          tenantId: tenantId(slug),
          code: d.metadata.code,
          name: d.metadata.name,
          description: d.metadata.description ?? null,
          ownerRoleCode: d.metadata.ownerRoleCode ?? null,
          workingDefinition: d,
          schemaVersion: d.schemaVersion ?? '1.0',
        },
      });
      const existing = await db.workflowVersion.findFirst({ where: { workflowId } });
      if (!existing) {
        await db.workflowVersion.create({
          data: {
            id: `${workflowId}-v1`,
            workflowId,
            version: 1,
            checksum: checksumOf(d),
            publishedAt: seedNow(),
            definition: d,
          },
        });
      }
    }

    // Instances + seed tasks
    const seededInstances = read('workflow-instances.json');
    for (const si of seededInstances) {
      const slug = si.tenantSlug;
      const tid = tenantId(slug);
      const def = defs.find((d) => d.metadata.tenantSlug === slug && d.metadata.code === si.workflowCode);
      const at = seedNow();
      const inst = await db.workflowInstance.upsert({
        where: { tenantId_instanceCode: { tenantId: tid, instanceCode: si.instanceCode } },
        update: {
          title: si.title,
          requesterEmail: si.requesterEmail,
          variables: si.variables ?? {},
          status: si.status ?? 'running',
          currentNodeId: si.currentNodeId ?? null,
        },
        create: {
          tenantId: tid,
          workflowCode: si.workflowCode,
          instanceCode: si.instanceCode,
          title: si.title,
          requesterEmail: si.requesterEmail,
          variables: si.variables ?? {},
          status: si.status ?? 'running',
          currentNodeId: si.currentNodeId ?? null,
          createdAt: at,
          updatedAt: at,
        },
      });
      const node = def?.nodes.find((n) => n.id === si.currentNodeId);
      if (node && STOP_TYPES.has(node.type)) {
        const seedTaskId = `seed-task-${si.instanceCode}`;
        const already = await db.approvalTask.findUnique({ where: { id: seedTaskId } });
        if (!already) {
          const a = node.config?.assignment ?? {};
          let role = a.roleCode ?? a.type ?? 'ROLE_PROCESS_ADMIN';
          if (a.type === 'requesterManager') role = 'ROLE_REQUESTER_MANAGER';
          await db.approvalTask.create({
            data: {
              id: seedTaskId,
              tenantId: tid,
              instanceId: inst.id,
              nodeId: node.id,
              nodeName: node.name,
              assigneeRole: role,
              status: 'open',
              slaHours: node.config?.slaHours ?? null,
              createdAt: at,
            },
          });
        }
      }
    }

    // Memberships — seed from canonical users (all.seed.json). Idempotent upsert.
    // Carries NO credential/secret; roles derived from primaryRole.
    try {
      const allSeed = JSON.parse(readFileSync(join(root, 'seed-data', 'all.seed.json'), 'utf8'));
      for (const u of allSeed.users ?? []) {
        const t = u.tenantId ?? 'tenant-xtech';
        const roles = u.primaryRole ? [u.primaryRole] : [];
        await db.membership.upsert({
          where: { tenantId_userId: { tenantId: t, userId: u.id } },
          update: { roles, status: 'active' },
          create: { tenantId: t, userId: u.id, roles, status: 'active' },
        });
      }
    } catch (e) {
      console.warn('membership seed skipped:', e.message);
    }

    const [tenants, workflows, versions, instances, tasks, memberships] = await Promise.all([
      db.tenant.count(),
      db.workflow.count(),
      db.workflowVersion.count(),
      db.workflowInstance.count(),
      db.approvalTask.count(),
      db.membership.count(),
    ]);
    console.log(
      `SEED OK | tenants=${tenants} workflows=${workflows} versions=${versions} instances=${instances} tasks=${tasks} memberships=${memberships}`,
    );
  },
  { maxWait: 20_000, timeout: 60_000 },
);

await prisma.$disconnect();
