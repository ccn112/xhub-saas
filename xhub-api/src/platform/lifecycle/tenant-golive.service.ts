import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BackupService } from '../../backup/backup.service';

interface TemplateStep {
  order: number;
  key: string;
  title: string;
  guidance?: string;
  suggestedRole?: string;
  templateRef?: string;
  required?: boolean;
}
interface ProgressStep {
  key: string;
  status: 'TODO' | 'DONE';
  assigneeId?: string | null;
  note?: string | null;
  at?: string | null;
}

/**
 * TenantGoLiveService — Go-Live checklist template resolution + per-tenant
 * progress + the one-way DEMO→LIVE activation. SHARED / platform-plane
 * (GoLiveChecklistTemplate + TenantGoLive have NO RLS): all access is via
 * withBypass. Activation reuses BackupService (pre-go-live snapshot, clear demo
 * data, go-live baseline) and flips Tenant.mode to LIVE. One-way: a LIVE tenant
 * can never reset-demo again.
 */
@Injectable()
export class TenantGoLiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly backup: BackupService,
  ) {}

  private get db() {
    return this.prisma.db as any;
  }

  private async readTenant(idOrCode: string) {
    const row = await this.prisma.withBypass<any>(() =>
      this.db.tenant.findFirst({
        where: { OR: [{ id: idOrCode }, { tenantCode: idOrCode }, { tenantKey: idOrCode }] },
      }),
    );
    if (!row) throw new NotFoundException(`tenant not found: ${idOrCode}`);
    return row;
  }

  /** Resolve the best go-live template for a tenant: per-blueprint > GENERIC. */
  async resolveTemplate(blueprintCode?: string | null) {
    return this.prisma.withBypass<any>(async () => {
      let tpl = null;
      if (blueprintCode) {
        tpl = await this.db.goLiveChecklistTemplate.findFirst({
          where: { blueprintCode, status: 'PUBLISHED' },
          orderBy: { version: 'desc' },
        });
      }
      if (!tpl) {
        tpl = await this.db.goLiveChecklistTemplate.findFirst({
          where: { scope: 'GENERIC', status: 'PUBLISHED' },
          orderBy: { version: 'desc' },
        });
      }
      if (!tpl) throw new NotFoundException('no PUBLISHED go-live template — run seed:golive-template');
      return tpl;
    });
  }

  async getProgress(idOrCode: string) {
    const tenant = await this.readTenant(idOrCode);
    const progress = await this.prisma.withBypass<any>(() =>
      this.db.tenantGoLive.findUnique({ where: { tenantId: tenant.id } }),
    );
    const template = await this.resolveTemplate(tenant.blueprintId).catch(() => null);
    return { tenant: { id: tenant.id, mode: tenant.mode, status: tenant.status }, template, progress };
  }

  /** Create (or return existing) per-tenant go-live progress from the template. */
  async createProgress(idOrCode: string, actorId?: string) {
    const tenant = await this.readTenant(idOrCode);
    const existing = await this.prisma.withBypass<any>(() =>
      this.db.tenantGoLive.findUnique({ where: { tenantId: tenant.id } }),
    );
    if (existing) return existing;

    const tpl = await this.resolveTemplate(tenant.blueprintId);
    const steps: ProgressStep[] = ((tpl.steps as TemplateStep[]) ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ key: s.key, status: 'TODO', assigneeId: null, note: null, at: null }));

    const row = await this.prisma.withBypass<any>(() =>
      this.db.tenantGoLive.create({
        data: {
          tenantId: tenant.id,
          templateCode: tpl.code,
          templateVersion: tpl.version,
          steps: steps as any,
          status: 'IN_PROGRESS',
        },
      }),
    );
    await this.audit(tenant.id, actorId, 'tenant.go-live.create', { templateCode: tpl.code, steps: steps.length });
    return row;
  }

  /** Mark a step done / set assignee / note. Recomputes READY when all required done. */
  async patchStep(idOrCode: string, key: string, patch: { status?: string; assigneeId?: string; note?: string }, actorId?: string) {
    const tenant = await this.readTenant(idOrCode);
    return this.prisma.withBypass<any>(async () => {
      const gl = await this.db.tenantGoLive.findUnique({ where: { tenantId: tenant.id } });
      if (!gl) throw new NotFoundException('go-live progress not started — POST go-live first');
      if (gl.status === 'LIVE') throw new BadRequestException('tenant is already LIVE — checklist is frozen');

      const steps: ProgressStep[] = (gl.steps as ProgressStep[]) ?? [];
      const step = steps.find((s) => s.key === key);
      if (!step) throw new NotFoundException(`unknown checklist step: ${key}`);
      if (patch.status != null) {
        if (patch.status !== 'TODO' && patch.status !== 'DONE') {
          throw new BadRequestException(`invalid step status: ${patch.status}`);
        }
        step.status = patch.status as 'TODO' | 'DONE';
        step.at = new Date().toISOString();
      }
      if (patch.assigneeId !== undefined) step.assigneeId = patch.assigneeId || null;
      if (patch.note !== undefined) step.note = patch.note || null;

      const tpl = await this.resolveTemplate(tenant.blueprintId);
      const requiredKeys = ((tpl.steps as TemplateStep[]) ?? []).filter((s) => s.required).map((s) => s.key);
      const allRequiredDone = requiredKeys.every((k) => steps.find((s) => s.key === k)?.status === 'DONE');
      const status = allRequiredDone ? 'READY' : 'IN_PROGRESS';

      const row = await this.db.tenantGoLive.update({
        where: { tenantId: tenant.id },
        data: { steps: steps as any, status },
      });
      await this.audit(tenant.id, actorId, 'tenant.go-live.step', { key, status: step.status });
      return row;
    });
  }

  /**
   * ACTIVATE go-live (DEMO → LIVE). Rejects if any REQUIRED step is not DONE
   * (400). Takes a pre-go-live snapshot, clears the tenant's demo business data,
   * sets Tenant.mode=LIVE, snapshots a go-live baseline, marks progress LIVE and
   * audits. One-way — a LIVE tenant can never reset-demo.
   */
  async activate(idOrCode: string, opts: { clearAll?: boolean } = {}, actorId?: string) {
    const tenant = await this.readTenant(idOrCode);
    if (tenant.mode === 'LIVE') {
      throw new BadRequestException(`tenant ${tenant.id} is already LIVE`);
    }
    const gl = await this.prisma.withBypass<any>(() =>
      this.db.tenantGoLive.findUnique({ where: { tenantId: tenant.id } }),
    );
    if (!gl) throw new BadRequestException('go-live progress not started — POST go-live first');

    const tpl = await this.resolveTemplate(tenant.blueprintId);
    const requiredKeys = ((tpl.steps as TemplateStep[]) ?? []).filter((s) => s.required).map((s) => s.key);
    const steps: ProgressStep[] = (gl.steps as ProgressStep[]) ?? [];
    const missing = requiredKeys.filter((k) => steps.find((s) => s.key === k)?.status !== 'DONE');
    if (missing.length > 0) {
      throw new BadRequestException(`required go-live steps not completed: ${missing.join(', ')}`);
    }

    // 1) Pre-go-live snapshot (before any destructive clear).
    const pre = await this.prisma.withTenant(tenant.id, () =>
      this.backup.createBackup(tenant.id, actorId ?? 'platform', 'PRE_GOLIVE'),
    );

    // 2) Clear demo business data.
    const clear = await this.backup.clearDemoData(tenant.id, opts.clearAll === true);

    // 3) Flip mode → LIVE (shared Tenant table).
    await this.prisma.withBypass<any>(() =>
      this.db.tenant.update({ where: { id: tenant.id }, data: { mode: 'LIVE' } }),
    );

    // 4) Go-live baseline snapshot (clean production start point).
    const goliveBaseline = await this.prisma.withTenant(tenant.id, () =>
      this.backup.createBackup(tenant.id, actorId ?? 'platform', 'GOLIVE_BASELINE'),
    );

    // 5) Mark progress LIVE.
    await this.prisma.withBypass<any>(() =>
      this.db.tenantGoLive.update({
        where: { tenantId: tenant.id },
        data: { status: 'LIVE', activatedAt: new Date() },
      }),
    );

    await this.audit(tenant.id, actorId, 'tenant.go-live.activate', {
      clearAll: opts.clearAll === true,
      preSnapshotId: pre.job.id,
      goliveBaselineId: goliveBaseline.job.id,
      cleared: clear.cleared,
      totalCleared: clear.total,
    });

    return {
      tenantId: tenant.id,
      mode: 'LIVE',
      preSnapshotId: pre.job.id,
      goliveBaselineId: goliveBaseline.job.id,
      cleared: clear.cleared,
      totalCleared: clear.total,
    };
  }

  private async audit(tenantId: string, actorId: string | undefined, action: string, detail: Record<string, any>) {
    try {
      await this.prisma.withBypass<any>(() =>
        this.db.auditLog.create({
          data: {
            tenantId,
            actorId: actorId || 'platform',
            instanceCode: 'platform.tenant-lifecycle',
            action,
            detail: JSON.stringify(detail),
          },
        }),
      );
    } catch {
      /* best-effort */
    }
  }
}
