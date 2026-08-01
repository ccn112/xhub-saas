import { Module } from '@nestjs/common';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { BackupSchedulerService } from './backup-scheduler.service';
import { BackupScheduleService } from './backup-schedule.service';
import { BackupScheduleController } from './backup-schedule.controller';
import { TenantScopeInterceptor } from '../xoffice/tenant-scope.interceptor';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Per-tenant logical Backup / Restore (Mục 6) + per-tenant periodic backup
 * SCHEDULE + retention (PH-04 / SaaS non-negotiable #11). Additive module.
 * Reuses the RLS PrismaService: backup export is RLS-scoped to the source
 * tenant; restore is cross-tenant (source → sandbox). The scheduler +
 * schedule-CRUD operate on the SHARED BackupSchedule table via withBypass and
 * run each tenant's backup under withTenant(tenantId). The @Interval is
 * discovered via ScheduleModule.forRoot() registered in XofficeModule.
 */
@Module({
  imports: [PrismaModule],
  controllers: [BackupController, BackupScheduleController],
  providers: [
    BackupService,
    BackupSchedulerService,
    BackupScheduleService,
    TenantScopeInterceptor,
  ],
  exports: [BackupService, BackupSchedulerService, BackupScheduleService],
})
export class BackupModule {}
