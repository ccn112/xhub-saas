import { Module } from '@nestjs/common';
import { ControlplaneService } from './controlplane.service';
import { ControlplaneController } from './controlplane.controller';
import { AppAdapterService } from './app-adapter.service';
import { TenantScopeInterceptor } from '../common/tenant-scope.interceptor';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Tenant Control Plane + Application Provisioning/Sync (S1–S2). Additive module.
 * Reuses the Identity/Org Core (source of user truth, global provider — see
 * IdentityModule.forPlatform()/forXoffice(), Stage C.5) and the RLS PrismaService.
 */
@Module({
  imports: [PrismaModule],
  controllers: [ControlplaneController],
  providers: [ControlplaneService, AppAdapterService, TenantScopeInterceptor],
  exports: [ControlplaneService],
})
export class ControlplaneModule {}
