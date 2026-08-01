import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PlatformModule } from '../platform.module';
import { TenantLaunchModule } from '../launch/tenant-launch.module';
import { CatalogModule } from '../catalog/catalog.module';
import { BackupModule } from '../../backup/backup.module';
import { ControlplaneModule } from '../../controlplane/controlplane.module';
import { OnboardingService } from './onboarding.service';
import { ReadinessService } from './readiness.service';
import { OnboardingController } from './onboarding.controller';

/**
 * Customer Onboarding + v1.0 Readiness module (T011). Additive ORCHESTRATION
 * layer — reuses the registry allocator (PlatformModule), the Launch Factory
 * (TenantLaunchModule), the catalog (CatalogModule), the backup schedule
 * (BackupModule) and the global AuthService (invite/activate). Adds NO new
 * provisioning engine and NO per-tenant branch logic.
 */
@Module({
  imports: [
    PrismaModule,
    PlatformModule,
    TenantLaunchModule,
    CatalogModule,
    BackupModule,
    ControlplaneModule,
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService, ReadinessService],
  exports: [OnboardingService, ReadinessService],
})
export class OnboardingModule {}
