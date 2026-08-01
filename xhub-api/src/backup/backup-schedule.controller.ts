import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { BackupScheduleService } from './backup-schedule.service';
import { BackupSchedulerService } from './backup-scheduler.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import type { UpsertScheduleInput } from './backup-schedule.service';

/**
 * Platform Console — per-tenant backup SCHEDULE + retention API (PH-04 backup
 * ops / SaaS non-negotiable #11). Platform plane: reads/writes the SHARED
 * BackupSchedule table via withBypass (cross-tenant config), NO
 * TenantScopeInterceptor. Gated by NEW platform codes platform.backup.read /
 * platform.backup.manage; the tenant PLATFORM_ADMIN=['*'] satisfies them via
 * wildcard.
 */
@Controller('api/platform')
export class BackupScheduleController {
  constructor(
    private readonly schedules: BackupScheduleService,
    private readonly scheduler: BackupSchedulerService,
  ) {}

  /** Manual scheduler tick (mirror /scheduler/tick) — force runs all enabled. */
  @Post('backups/tick')
  @RequirePermission('platform.backup.manage')
  tick(@Query('force') force?: string, @Query('failTenant') failTenant?: string) {
    const fail = failTenant ? failTenant.split(',').filter(Boolean) : [];
    return this.scheduler.runDueBackups(new Date(), force === 'true' || force === '1', fail);
  }

  @Get('backup-schedules')
  @RequirePermission('platform.backup.read')
  list() {
    return this.schedules.list();
  }

  @Get('backup-schedules/:tenantId')
  @RequirePermission('platform.backup.read')
  get(@Param('tenantId') tenantId: string) {
    return this.schedules.get(tenantId);
  }

  @Get('backup-schedules/:tenantId/backups')
  @RequirePermission('platform.backup.read')
  history(@Param('tenantId') tenantId: string) {
    return this.schedules.history(tenantId);
  }

  @Put('backup-schedules/:tenantId')
  @RequirePermission('platform.backup.manage')
  upsert(@Param('tenantId') tenantId: string, @Body() body: UpsertScheduleInput) {
    return this.schedules.upsert(tenantId, body ?? {});
  }

  @Post('backup-schedules/:tenantId/run-now')
  @RequirePermission('platform.backup.manage')
  runNow(@Param('tenantId') tenantId: string) {
    return this.schedules.runNow(tenantId);
  }
}
