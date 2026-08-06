import { Module } from '@nestjs/common';
import { SupportCasesService } from './support-cases.service';
import { SupportCasesController } from './support-cases.controller';
import { EngineeringSupportClient } from './engineering-support.client';
import { XofficePrismaModule } from '../xoffice-prisma/xoffice-prisma.module';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';

/**
 * Product Customer Support module (2026-08-06). Additive, X.Office process
 * only. EngineeringSupportClient is a plain HTTP client (no cross-process
 * Nest import) to the Platform process's /api/engineering/* routes, used
 * only by the escalate action — same shape as DeliveryModule's
 * LaunchFactoryClient.
 */
@Module({
  imports: [XofficePrismaModule],
  controllers: [SupportCasesController],
  providers: [SupportCasesService, EngineeringSupportClient, XofficeTenantScopeInterceptor],
  exports: [SupportCasesService],
})
export class SupportCasesModule {}
