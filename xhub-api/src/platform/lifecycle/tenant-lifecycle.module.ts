import { Module } from '@nestjs/common';
import { TenantLifecycleController } from './tenant-lifecycle.controller';
import { TenantGoLiveService } from './tenant-golive.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { BackupModule } from '../../backup/backup.module';
import { PlatformModule } from '../platform.module';

/**
 * Tenant Lifecycle module (DEMO ↔ LIVE + reset-demo + go-live checklist).
 * Additive. Reuses BackupService (baseline/reset/clear) + TenantRegistryService
 * (shared Tenant lookups). Platform plane — no RLS interceptor.
 */
@Module({
  imports: [PrismaModule, BackupModule, PlatformModule],
  controllers: [TenantLifecycleController],
  providers: [TenantGoLiveService],
  exports: [TenantGoLiveService],
})
export class TenantLifecycleModule {}
