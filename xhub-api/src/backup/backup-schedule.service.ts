import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BackupService } from './backup.service';
import { BackupSchedulerService } from './backup-scheduler.service';

const VALID_FREQ = ['DAILY', 'WEEKLY', 'MONTHLY'];

export interface UpsertScheduleInput {
  enabled?: boolean;
  frequency?: string;
  hourUtc?: number;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  retentionDays?: number;
  retentionWeeks?: number;
  retentionMonths?: number;
}

/**
 * Platform-plane CRUD over the SHARED BackupSchedule table (like
 * TenantRegistryService over Tenant): all access via prisma.withBypass, never
 * withTenant. One schedule per tenant (unique tenantId). Per-tenant backup
 * HISTORY is read RLS-scoped via withTenant(tenantId).
 */
@Injectable()
export class BackupScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly backup: BackupService,
    private readonly scheduler: BackupSchedulerService,
  ) {}

  private get db() {
    return this.prisma.db;
  }

  /** All schedules (every tenant) + lastRun/status/alert. */
  list() {
    return this.prisma.withBypass(() =>
      (this.db as any).backupSchedule.findMany({ orderBy: { tenantId: 'asc' } }),
    );
  }

  async get(tenantId: string) {
    const row = await this.prisma.withBypass(() =>
      (this.db as any).backupSchedule.findUnique({ where: { tenantId } }),
    );
    if (!row) throw new NotFoundException(`no backup schedule for tenant: ${tenantId}`);
    return row;
  }

  /** Upsert (enable/frequency/time/retention). Recomputes nextRunAt. */
  async upsert(tenantId: string, input: UpsertScheduleInput) {
    if (input.frequency != null && !VALID_FREQ.includes(input.frequency)) {
      throw new BadRequestException(`invalid frequency: ${input.frequency}`);
    }
    if (input.hourUtc != null && (input.hourUtc < 0 || input.hourUtc > 23)) {
      throw new BadRequestException(`hourUtc must be 0..23`);
    }

    const data: Record<string, any> = {};
    for (const k of [
      'enabled', 'frequency', 'hourUtc', 'dayOfWeek', 'dayOfMonth',
      'retentionDays', 'retentionWeeks', 'retentionMonths',
    ] as const) {
      if (input[k] !== undefined) data[k] = input[k];
    }

    return this.prisma.withBypass(async () => {
      const existing = await (this.db as any).backupSchedule.findUnique({ where: { tenantId } });
      const merged = { ...(existing ?? { frequency: 'DAILY', hourUtc: 19 }), ...data };
      const nextRunAt = this.scheduler.computeNextRunAt(new Date(), merged as any);
      if (existing) {
        return (this.db as any).backupSchedule.update({
          where: { tenantId },
          data: { ...data, nextRunAt },
        });
      }
      return (this.db as any).backupSchedule.create({
        data: { tenantId, ...data, nextRunAt },
      });
    });
  }

  /** Immediate backup for one tenant (RLS-scoped) + retention prune. */
  async runNow(tenantId: string) {
    const sched: any = await this.prisma.withBypass(() =>
      (this.db as any).backupSchedule.findUnique({ where: { tenantId } }),
    );
    const result = await this.prisma.withTenant(tenantId, () =>
      this.backup.createBackup(tenantId, 'run-now'),
    );
    if (sched) {
      const pruned = await this.scheduler.pruneRetention(tenantId, sched);
      await this.prisma.withBypass(() =>
        (this.db as any).backupSchedule.update({
          where: { tenantId },
          data: { lastRunAt: new Date(), lastStatus: 'completed', lastError: null, alert: false },
        }),
      );
      return { backupId: result.job.id, pruned, manifest: result.manifest };
    }
    return { backupId: result.job.id, pruned: 0, manifest: result.manifest };
  }

  /** Per-tenant backup history (RLS-scoped read). */
  history(tenantId: string) {
    return this.prisma.withTenant(tenantId, () => this.backup.listBackups(tenantId));
  }
}
