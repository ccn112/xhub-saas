import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SeedModule } from './seed/seed.module';
import { IdentityModule } from './identity/identity.module';
import { ControlplaneModule } from './controlplane/controlplane.module';
import { MdmModule } from './mdm/mdm.module';
import { BackupModule } from './backup/backup.module';
import { WebhookModule } from './webhook/webhook.module';
import { PlatformModule } from './platform/platform.module';
import { TenantLaunchModule } from './platform/launch/tenant-launch.module';
import { CatalogModule } from './platform/catalog/catalog.module';
import { OnboardingModule } from './platform/onboarding/onboarding.module';
import { TenantLifecycleModule } from './platform/lifecycle/tenant-lifecycle.module';
import { EngineeringModule } from './engineering/engineering.module';
import { ProjectCatalogModule } from './project-catalog/project-catalog.module';
import { ProvidersModule } from './providers/providers.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ProductsModule } from './products/products.module';

/**
 * XHub Platform process — Phase 1.5 Stage B composition root. Carries the
 * XHUB_PLATFORM module group (control plane, master data, backup, webhook
 * outbox dispatcher, tenant launch/catalog/onboarding/lifecycle) plus the
 * SHARED library modules (prisma/auth/seed/identity) every process needs for
 * its own guards + tenant/identity resolution. Boots via `main-platform.ts`.
 * See docs/implementation/xoffice-ai/IMPLEMENTATION_PLAN.md Phase 1.5 Stage B
 * for the module classification this mirrors.
 */
@Module({
  imports: [
    PrismaModule,
    AuthModule.forPlatform(),
    SeedModule,
    IdentityModule.forPlatform(),
    ControlplaneModule,
    MdmModule,
    BackupModule,
    WebhookModule,
    PlatformModule,
    TenantLaunchModule,
    CatalogModule,
    OnboardingModule,
    TenantLifecycleModule,
    EngineeringModule,
    ProjectCatalogModule,
    ProvidersModule,
    DiscoveryModule,
    OrganizationsModule,
    ProductsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class PlatformAppModule {}
