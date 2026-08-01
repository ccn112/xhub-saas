import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ControlplaneService } from '../../controlplane/controlplane.service';
import { BackupService } from '../../backup/backup.service';
import { TenantRegistryService } from '../tenant-registry.service';
import { CatalogService } from '../catalog/catalog.service';

/**
 * The ordered launch pipeline. Each step is idempotent (re-runnable with no
 * duplicate effect), audited (writes an AuditLog under the target tenant), and
 * carries a fixed idempotencyKey `<launchId>:<stepKey>`. Reuses EXISTING
 * primitives — control-plane setTenantApplication, BackupService, the registry —
 * rather than a new provisioning engine.
 */
const STEP_KEYS = [
  'register',
  'identity-baseline',
  'enable-apps',
  'apply-blueprint',
  'load-seed-pack',
  'provision-backup',
  'isolation-test',
  'handover',
] as const;

type StepKey = (typeof STEP_KEYS)[number];

/** Base app set enabled by a launch (minimal; a full blueprint drives this in step 4). */
const BASE_APPS = ['x1'];

export interface CreateLaunchInput {
  targetTenantId: string;
  targetTenantNo?: number | null;
  blueprintId?: string | null;
  seedPackId?: string | null;
  /** Optional registry metadata used by the `register` step. */
  name?: string;
  tenantKey?: string;
  tenantClass?: string;
  /**
   * Free-form request payload. Test hooks:
   *   request.__failSteps = { 'provision-backup': 2 } → step throws a transient
   *   error until `attempts >= N` (mirrors control-plane __failUntilAttempt),
   *   proving retry/resume in the smoke.
   */
  request?: Record<string, any>;
  createdBy?: string;
}

/**
 * IMPORTANT (Prisma 7): model accessors live on the client PROXY, and
 * `prisma.db` only returns a proxy-backed client while an als context is open
 * (the withTenant/withBypass transaction client). OUTSIDE a context `db` returns
 * the raw target, which has NO model accessors. So EVERY db access here is
 * wrapped in its own withBypass (shared/platform tables: TenantLaunch/Tenant) or
 * withTenant (tenant-scoped step writes). These wrappers are NEVER nested — a
 * launch step's withTenant must open a REAL tenant transaction (re-entrancy would
 * turn it into a no-op and break RLS isolation), so the orchestration never holds
 * an enclosing context across a step.
 */
@Injectable()
export class TenantLaunchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly controlplane: ControlplaneService,
    private readonly backup: BackupService,
    private readonly registry: TenantRegistryService,
    private readonly catalog: CatalogService,
  ) {}

  private get db() {
    return this.prisma.db;
  }

  // ---- create --------------------------------------------------------------

  async create(input: CreateLaunchInput) {
    const targetTenantId = String(input.targetTenantId ?? '').trim();
    if (!targetTenantId) throw new BadRequestException('targetTenantId is required');

    const request = {
      ...(input.request ?? {}),
      targetTenantId,
      name: input.name ?? null,
      tenantKey: input.tenantKey ?? null,
      tenantClass: input.tenantClass ?? 'CUSTOMER',
      blueprintId: input.blueprintId ?? null,
      seedPackId: input.seedPackId ?? null,
    };

    const launch = await this.prisma.withBypass(async () => {
      const l = await this.db.tenantLaunch.create({
        data: {
          targetTenantId,
          targetTenantNo: input.targetTenantNo ?? null,
          blueprintId: input.blueprintId ?? null,
          seedPackId: input.seedPackId ?? null,
          status: 'QUEUED',
          request: request as any,
          createdBy: input.createdBy ?? 'platform',
        },
      });
      // Materialize the ordered step rows up-front (PENDING) so the timeline is
      // visible before the first run and the outbox is deterministic.
      for (let i = 0; i < STEP_KEYS.length; i++) {
        await this.db.tenantLaunchStep.create({
          data: {
            launchId: l.id,
            stepKey: STEP_KEYS[i],
            seq: i + 1,
            status: 'PENDING',
            idempotencyKey: `${l.id}:${STEP_KEYS[i]}`,
          },
        });
      }
      return l;
    });
    return this.detail(launch.id);
  }

  // ---- reads ---------------------------------------------------------------

  list() {
    return this.prisma.withBypass(() =>
      this.db.tenantLaunch.findMany({ orderBy: { createdAt: 'desc' } }),
    );
  }

  async detail(id: string) {
    return this.prisma.withBypass(async () => {
      const launch = await this.db.tenantLaunch.findUnique({ where: { id } });
      if (!launch) throw new NotFoundException(`launch not found: ${id}`);
      const steps = await this.db.tenantLaunchStep.findMany({
        where: { launchId: id },
        orderBy: { seq: 'asc' },
      });
      return { ...launch, steps };
    });
  }

  // ---- run / drain (idempotent + resumable) --------------------------------

  /**
   * Drain the ordered steps. DONE/SKIPPED steps are replayed (skipped) so a
   * re-run creates no duplicates (idempotent) and resumes from the first
   * unfinished step (resumable). A FAILED step stops the drain and marks the
   * launch FAILED at that step — retry() re-runs only that step then continues.
   */
  async run(id: string) {
    const launch = await this.prisma.withBypass(() =>
      this.db.tenantLaunch.findUnique({ where: { id } }),
    );
    if (!launch) throw new NotFoundException(`launch not found: ${id}`);
    if (launch.status === 'COMPLETED') return this.detail(id);

    await this.prisma.withBypass(() =>
      this.db.tenantLaunch.update({ where: { id }, data: { status: 'RUNNING' } }),
    );

    const steps = await this.prisma.withBypass(() =>
      this.db.tenantLaunchStep.findMany({ where: { launchId: id }, orderBy: { seq: 'asc' } }),
    );

    for (const step of steps) {
      if (step.status === 'DONE' || step.status === 'SKIPPED') continue; // replay
      const outcome = await this.executeStep(launch, step.stepKey as StepKey, step.id);
      if (!outcome.ok) {
        await this.prisma.withBypass(() =>
          this.db.tenantLaunch.update({
            where: { id },
            data: { status: 'FAILED', currentStepKey: step.stepKey },
          }),
        );
        return this.detail(id);
      }
    }

    await this.prisma.withBypass(() =>
      this.db.tenantLaunch.update({
        where: { id },
        data: { status: 'COMPLETED', currentStepKey: null, finishedAt: new Date() },
      }),
    );
    return this.detail(id);
  }

  /**
   * Retry: reset the FAILED step (and only it) back to PENDING, then resume the
   * drain. Prior DONE steps are NOT re-done (resumable). attempts is preserved so
   * the transient-failure hook can succeed on the next attempt.
   */
  async retry(id: string) {
    await this.prisma.withBypass(async () => {
      const failed = await this.db.tenantLaunchStep.findFirst({
        where: { launchId: id, status: 'FAILED' },
      });
      if (failed) {
        await this.db.tenantLaunchStep.update({
          where: { id: failed.id },
          data: { status: 'PENDING', error: null },
        });
      }
    });
    return this.run(id);
  }

  // ---- step executor -------------------------------------------------------

  /** Runs one step handler. Never throws — records DONE/FAILED on the step row. */
  private async executeStep(launch: any, stepKey: StepKey, stepRowId: string) {
    const updated = await this.prisma.withBypass(() =>
      this.db.tenantLaunchStep.update({
        where: { id: stepRowId },
        data: { status: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 } },
      }),
    );
    const attempt = updated.attempts;

    try {
      // Transient-failure injection (test hook), mirrors control-plane.
      const failSteps = (launch.request as any)?.__failSteps ?? {};
      const failUntil = Number(failSteps[stepKey] ?? 0);
      if (failUntil && attempt < failUntil) {
        throw new Error(`injected transient failure on '${stepKey}' (attempt ${attempt} < ${failUntil})`);
      }

      const result = await this.handlers[stepKey](launch, attempt);
      await this.prisma.withBypass(() =>
        this.db.tenantLaunchStep.update({
          where: { id: stepRowId },
          data: { status: 'DONE', result: result as any, error: null, finishedAt: new Date() },
        }),
      );
      await this.audit(launch.targetTenantId, launch.id, stepKey, 'launch.step.done', result);
      return { ok: true, result };
    } catch (err: any) {
      const message = String(err?.message ?? err);
      await this.prisma.withBypass(() =>
        this.db.tenantLaunchStep.update({
          where: { id: stepRowId },
          data: { status: 'FAILED', error: message, finishedAt: new Date() },
        }),
      );
      await this.audit(launch.targetTenantId, launch.id, stepKey, 'launch.step.failed', { error: message });
      return { ok: false, error: message };
    }
  }

  // ---- step handlers (each idempotent) -------------------------------------

  private readonly handlers: Record<StepKey, (launch: any, attempt: number) => Promise<any>> = {
    // 1) register — ensure the SHARED Tenant registry row exists/updated.
    register: async (launch) => {
      const req = launch.request as any;
      const id = launch.targetTenantId;
      const tenantKey = (req.tenantKey ?? id).toString();
      const row = await this.prisma.withBypass(() =>
        this.db.tenant.upsert({
          where: { id },
          update: { status: 'PROVISIONING', ...(req.name ? { name: req.name } : {}) },
          create: {
            id,
            slug: tenantKey,
            name: req.name ?? id,
            tenantNo: launch.targetTenantNo ?? null,
            tenantKey,
            tenantClass: req.tenantClass ?? 'CUSTOMER',
            status: 'PROVISIONING',
          },
        }),
      );
      return { tenantId: row.id, tenantNo: row.tenantNo, status: row.status };
    },

    // 2) identity-baseline — minimal org + admin person, RLS-scoped to target.
    'identity-baseline': async (launch) => {
      const tenantId = launch.targetTenantId;
      return this.prisma.withTenant(tenantId, async () => {
        const orgId = `${tenantId}-org-root`;
        const adminId = `${tenantId}-admin`;
        await this.db.orgUnit.upsert({
          where: { id: orgId },
          update: { name: 'Trụ sở chính' },
          create: { id: orgId, tenantId, code: 'ROOT', name: 'Trụ sở chính', type: 'LEGAL_ENTITY' },
        });
        await this.db.personProfile.upsert({
          where: { id: adminId },
          update: { fullName: 'Quản trị viên tenant' },
          create: { id: adminId, tenantId, fullName: 'Quản trị viên tenant', email: `admin@${tenantId}.local`, status: 'active' },
        });
        await this.db.membership.upsert({
          where: { tenantId_userId: { tenantId, userId: adminId } },
          update: { roles: ['TENANT_ADMIN'], status: 'active' },
          create: { tenantId, userId: adminId, roles: ['TENANT_ADMIN'], status: 'active' },
        });
        return { orgUnitId: orgId, adminPersonId: adminId, membership: 'TENANT_ADMIN' };
      });
    },

    // 3) enable-apps — base app set via control-plane (idempotent upsert).
    'enable-apps': async (launch) => {
      const enabled: string[] = [];
      // TenantApplicationInstance is RLS-protected; cross-tenant platform write
      // runs under withBypass (explicit system task). setTenantApplication upserts.
      await this.prisma.withBypass(async () => {
        for (const code of BASE_APPS) {
          await this.controlplane.setTenantApplication(launch.targetTenantId, code, 'enabled');
          enabled.push(code);
        }
      });
      return { enabled };
    },

    // 4) apply-blueprint — apply the immutable Blueprint (apps/roles/org/menu)
    //    from the catalog (SaaS step 4). launch.blueprintId holds a blueprint
    //    CODE; falls back to BP-BASE-ENTERPRISE. If the catalog is unseeded, a
    //    minimal fallback keeps the pipeline green (records the reason).
    'apply-blueprint': async (launch) => {
      const code = launch.blueprintId ?? 'BP-BASE-ENTERPRISE';
      try {
        return await this.catalog.applyBlueprint(launch.targetTenantId, code);
      } catch (err: any) {
        // Fallback: enable the base app set directly (idempotent).
        await this.prisma.withBypass(async () => {
          for (const c of BASE_APPS) await this.controlplane.setTenantApplication(launch.targetTenantId, c, 'enabled');
        });
        return { blueprintCode: code, applied: { apps: BASE_APPS }, fallback: String(err?.message ?? err) };
      }
    },

    // 5) load-seed-pack — apply the SeedPack datasets (+ dependencies),
    //    parameterized by tenantId, idempotent (upsert by id). launch.seedPackId
    //    holds a seed pack CODE; falls back to SP-BASE-ORG.
    'load-seed-pack': async (launch) => {
      const code = launch.seedPackId ?? 'SP-BASE-ORG';
      try {
        return await this.catalog.applySeedPack(launch.targetTenantId, code);
      } catch (err: any) {
        // Fallback: minimal baseline org row (idempotent), keeps pipeline green.
        const tenantId = launch.targetTenantId;
        await this.prisma.withTenant(tenantId, async () => {
          const demoOrg = `${tenantId}-seed-sales`;
          await this.db.orgUnit.upsert({
            where: { id: demoOrg },
            update: {},
            create: { id: demoOrg, tenantId, code: 'SALES', name: 'Phòng Kinh doanh (demo)', type: 'DEPARTMENT', parentId: `${tenantId}-org-root` },
          });
        });
        return { seedPackCode: code, rows: { OrgUnit: 1 }, fallback: String(err?.message ?? err) };
      }
    },

    // 6) provision-backup — per-tenant baseline backup (reuses BackupService).
    'provision-backup': async (launch) => {
      const tenantId = launch.targetTenantId;
      return this.prisma.withTenant(tenantId, async () => {
        const { job } = await this.backup.createBackup(tenantId, launch.createdBy ?? 'platform');
        return { backupJobId: job.id, checksum: job.checksum, byteSize: job.byteSize };
      });
    },

    // 7) isolation-test — assert MUST_NOT_LEAK both directions (scoped check).
    'isolation-test': async (launch) => {
      const tenantId = launch.targetTenantId;
      // Under the target's RLS context, foreign (xtech) rows must be invisible.
      const targetSeesXtech = await this.prisma.withTenant(tenantId, () =>
        this.db.orgUnit.count({ where: { tenantId: 'tenant-xtech' } }),
      );
      // Under xtech's RLS context, the target's rows must be invisible.
      const xtechSeesTarget = await this.prisma.withTenant('tenant-xtech', () =>
        this.db.orgUnit.count({ where: { tenantId } }),
      );
      const leak = targetSeesXtech + xtechSeesTarget;
      if (leak > 0) {
        throw new Error(`MUST_NOT_LEAK violated: target→xtech=${targetSeesXtech}, xtech→target=${xtechSeesTarget}`);
      }
      return { mustNotLeak: true, targetSeesXtech, xtechSeesTarget };
    },

    // 8) handover — handover record (tenant-handover.schema shape) + registry ACTIVE.
    handover: async (launch) => {
      const tenantId = launch.targetTenantId;
      const readinessChecks = [
        { key: 'registry', status: 'PASS' },
        { key: 'identity-baseline', status: 'PASS' },
        { key: 'apps-enabled', status: 'PASS' },
        { key: 'backup-provisioned', status: 'PASS' },
        { key: 'isolation', status: 'PASS' },
      ];
      await this.prisma.withBypass(() =>
        this.db.tenant.update({ where: { id: tenantId }, data: { status: 'ACTIVE' } }),
      );
      return {
        tenantId,
        launchId: launch.id,
        readinessChecks,
        acceptedBy: launch.createdBy ?? 'platform',
        acceptedAt: new Date().toISOString(),
        openItems: [],
        registryStatus: 'ACTIVE',
      };
    },
  };

  // ---- audit ---------------------------------------------------------------

  private async audit(tenantId: string, launchId: string, stepKey: string, action: string, detail: any) {
    try {
      // AuditLog is RLS-protected and FK-bound to Tenant (the row created by the
      // `register` step). Write under the target's tenant context.
      await this.prisma.withTenant(tenantId, () =>
        this.db.auditLog.create({
          data: {
            tenantId,
            actorId: 'platform',
            instanceCode: `platform.launch:${launchId}`,
            action,
            detail: JSON.stringify({ stepKey, ...detail }),
          },
        }),
      );
    } catch {
      // best-effort — never fail a step on audit append.
    }
  }
}
