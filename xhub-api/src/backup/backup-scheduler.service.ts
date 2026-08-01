import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { BackupService } from './backup.service';

export interface RunDueResult {
  now: string;
  force: boolean;
  considered: number;
  ran: string[]; // tenantIds successfully backed up
  failed: string[]; // tenantIds whose scheduled backup failed (isolated)
  skipped: string[]; // enabled but not due
  pruned: Record<string, number>; // tenantId -> #backups pruned by retention
}

/**
 * Per-tenant periodic backup + retention worker (PH-04 / SaaS non-negotiable
 * #11). Mirrors src/xoffice/scheduler.service.ts: a SLOW @Interval for
 * dev/demo + a manual POST /api/platform/backups/tick for tests (fixed clock).
 *
 * Every tenant has its own SCHEDULE (shared BackupSchedule table), its own
 * storage folder (storage/backups/<tenantId>/…, already the case) and its own
 * retention. runDueBackups iterates ACTIVE registry tenants whose enabled
 * schedule is due (nextRunAt <= now, or force), runs BackupService.createBackup
 * under withTenant(tenantId) (RLS-scoped), prunes old backups WITHIN THAT
 * tenant's folder only, and records lastRun/status/nextRun. One tenant's failure
 * is isolated (caught, marked FAILED + alert) and never blocks the others.
 */
@Injectable()
export class BackupSchedulerService {
  private readonly log = new Logger('BackupScheduler');

  /** Test hook: force createBackup to throw for these tenantIds (failure isolation). */
  readonly failTenants = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly backup: BackupService,
  ) {}

  private get db() {
    return this.prisma.db;
  }

  /** Slow sweep (dev/demo). Only backs up tenants that are actually DUE, so it
   *  does not accumulate backups: a DAILY schedule's nextRunAt sits in the
   *  future and is skipped on every tick until its window arrives. */
  @Interval(3_600_000) // hourly
  async sweep(): Promise<void> {
    try {
      const res = await this.runDueBackups(new Date());
      if (res.ran.length || res.failed.length) {
        this.log.log(`sweep: ran=${res.ran.length} failed=${res.failed.length}`);
      }
    } catch (e) {
      this.log.error(`sweep failed: ${(e as Error).message}`);
    }
  }

  private storageBase(): string {
    return process.env.BACKUP_STORAGE_DIR ?? join(process.cwd(), 'storage', 'backups');
  }

  /** ACTIVE registry tenants (shared Tenant table). Excludes non-ACTIVE + system. */
  private activeTenantIds(): Promise<string[]> {
    return this.prisma.withBypass(async () => {
      const rows = await (this.db as any).tenant.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });
      return (rows as { id: string }[]).map((r) => r.id);
    });
  }

  /** Compute the next run time from frequency, anchored at hourUtc (+ day-of-*). */
  computeNextRunAt(
    from: Date,
    sched: { frequency: string; hourUtc: number; dayOfWeek?: number | null; dayOfMonth?: number | null },
  ): Date {
    const next = new Date(from.getTime());
    next.setUTCMinutes(0, 0, 0);
    next.setUTCHours(sched.hourUtc);
    if (next.getTime() <= from.getTime()) next.setUTCDate(next.getUTCDate() + 1);

    if (sched.frequency === 'WEEKLY') {
      const target = sched.dayOfWeek ?? 0;
      // advance to the target weekday (0..6, 0=Sunday)
      while (next.getUTCDay() !== target) next.setUTCDate(next.getUTCDate() + 1);
    } else if (sched.frequency === 'MONTHLY') {
      const target = Math.min(Math.max(sched.dayOfMonth ?? 1, 1), 28);
      if (next.getUTCDate() > target) {
        // roll to next month
        next.setUTCMonth(next.getUTCMonth() + 1, target);
      } else {
        next.setUTCDate(target);
      }
      next.setUTCHours(sched.hourUtc, 0, 0, 0);
      if (next.getTime() <= from.getTime()) next.setUTCMonth(next.getUTCMonth() + 1, target);
    }
    return next;
  }

  /**
   * Run every DUE tenant's scheduled backup (or all enabled schedules when
   * force=true). Failures are isolated per tenant.
   */
  async runDueBackups(
    now: Date = new Date(),
    force = false,
    failTenantIds: string[] = [],
  ): Promise<RunDueResult> {
    const activeIds = new Set(await this.activeTenantIds());

    const schedules = await this.prisma.withBypass(() =>
      (this.db as any).backupSchedule.findMany({ where: { enabled: true } }),
    );

    const res: RunDueResult = {
      now: now.toISOString(),
      force,
      considered: 0,
      ran: [],
      failed: [],
      skipped: [],
      pruned: {},
    };

    for (const sched of schedules as any[]) {
      if (!activeIds.has(sched.tenantId)) continue; // only ACTIVE registry tenants
      res.considered++;

      const due = force || sched.nextRunAt == null || new Date(sched.nextRunAt).getTime() <= now.getTime();
      if (!due) {
        res.skipped.push(sched.tenantId);
        continue;
      }

      try {
        if (this.failTenants.has(sched.tenantId) || failTenantIds.includes(sched.tenantId)) {
          throw new Error('forced failure (test hook)');
        }
        // RLS-scoped backup of exactly this one tenant (mirrors the HTTP path).
        await this.prisma.withTenant(sched.tenantId, () =>
          this.backup.createBackup(sched.tenantId, 'scheduler'),
        );
        const pruned = await this.pruneRetention(sched.tenantId, sched);
        res.pruned[sched.tenantId] = pruned;
        res.ran.push(sched.tenantId);

        const nextRunAt = this.computeNextRunAt(now, sched);
        await this.prisma.withBypass(() =>
          (this.db as any).backupSchedule.update({
            where: { id: sched.id },
            data: {
              lastRunAt: now,
              lastStatus: 'completed',
              lastError: null,
              alert: false,
              nextRunAt,
            },
          }),
        );
      } catch (e: any) {
        // ISOLATION: this tenant's failure must not block the others.
        const msg = String(e?.message ?? e);
        res.failed.push(sched.tenantId);
        this.log.error(`scheduled backup FAILED for ${sched.tenantId}: ${msg}`);
        const nextRunAt = this.computeNextRunAt(now, sched);
        await this.prisma.withBypass(async () => {
          await (this.db as any).backupSchedule.update({
            where: { id: sched.id },
            data: { lastRunAt: now, lastStatus: 'FAILED', lastError: msg, alert: true, nextRunAt },
          });
          // Alert (queryable) — tenant-scoped AuditLog under bypass with explicit tenantId.
          await (this.db as any).auditLog
            .create({
              data: {
                tenantId: sched.tenantId,
                actorId: 'scheduler',
                instanceCode: 'platform.backup-scheduler',
                action: 'backup.schedule.failed',
                detail: JSON.stringify({ error: msg, at: now.toISOString() }),
              },
            })
            .catch(() => {});
        });
      }
    }
    return res;
  }

  /**
   * Retention prune for ONE tenant. v1 GFS-lite: keep the most recent
   * `retentionDays` days of completed backups; delete older completed backups
   * (rows + their storage/backups/<tenantId>/<backupId> folders). NEVER deletes
   * the single most-recent backup, and NEVER touches another tenant's folder
   * (delete is scoped to this tenantId AND the path is built from this tenantId).
   * Returns the number of backups pruned.
   */
  async pruneRetention(
    tenantId: string,
    sched: { retentionDays: number },
  ): Promise<number> {
    return this.prisma.withTenant(tenantId, async () => {
      const jobs: { id: string; createdAt: Date; status: string }[] = await (this.db as any).backupJob.findMany({
        // DEMO_BASELINE is the immutable golden snapshot — excluded from retention pruning.
        where: { tenantId, status: 'completed', kind: { not: 'DEMO_BASELINE' } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true, status: true },
      });
      if (jobs.length <= 1) return 0; // never delete the only/most-recent backup

      const cutoff = Date.now() - sched.retentionDays * 24 * 60 * 60 * 1000;
      // Always keep index 0 (most recent). Prune older-than-cutoff among the rest.
      const victims = jobs.slice(1).filter((j) => new Date(j.createdAt).getTime() < cutoff);

      let pruned = 0;
      for (const v of victims) {
        // Delete the folder — path is derived ONLY from this tenantId, so a prune
        // can never reach into another tenant's folder.
        const dir = join(this.storageBase(), tenantId, v.id);
        try {
          rmSync(dir, { recursive: true, force: true });
        } catch {
          /* best-effort */
        }
        await (this.db as any).backupJob.delete({ where: { id: v.id } }).catch(() => {});
        pruned++;
      }
      return pruned;
    });
  }
}
