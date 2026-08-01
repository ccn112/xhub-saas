import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ControlplaneModule } from '../../controlplane/controlplane.module';
import { BackupModule } from '../../backup/backup.module';
import { PlatformModule } from '../platform.module';
import { CatalogModule } from '../catalog/catalog.module';
import { TenantLaunchController } from './tenant-launch.controller';
import { TenantLaunchService } from './tenant-launch.service';

/**
 * Tenant Launch Factory module (SaaS step 3 — E4). Additive. Orchestrates
 * idempotent/retryable/resumable/audited tenant provisioning by REUSING existing
 * primitives: control-plane setTenantApplication (enable apps), BackupService
 * (per-tenant backup), the Tenant registry (register/activate), and the identity
 * baseline seed pattern — no new provisioning engine.
 */
@Module({
  imports: [PrismaModule, ControlplaneModule, BackupModule, PlatformModule, CatalogModule],
  controllers: [TenantLaunchController],
  providers: [TenantLaunchService],
  exports: [TenantLaunchService],
})
export class TenantLaunchModule {}
