import { Module } from '@nestjs/common';
import { ControlplaneService } from './controlplane.service';
import { ControlplaneController } from './controlplane.controller';
import { AppAdapterService } from './app-adapter.service';
import { TenantScopeInterceptor } from '../xoffice/tenant-scope.interceptor';
import { PrismaModule } from '../prisma/prisma.module';
import { IdentityModule } from '../identity/identity.module';

/**
 * Tenant Control Plane + Application Provisioning/Sync (S1–S2). Additive module.
 * Reuses the Identity/Org Core (source of user truth) and the RLS PrismaService.
 */
@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [ControlplaneController],
  providers: [ControlplaneService, AppAdapterService, TenantScopeInterceptor],
  exports: [ControlplaneService],
})
export class ControlplaneModule {}
