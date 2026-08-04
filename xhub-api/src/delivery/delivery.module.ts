import { Module } from '@nestjs/common';
import { EngagementsService } from './engagements.service';
import { EngagementsController } from './engagements.controller';
import { XofficePrismaModule } from '../xoffice-prisma/xoffice-prisma.module';
import { RecordsModule } from '../records/records.module';
import { LaunchFactoryClient } from './launch-factory.client';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';

/**
 * Solution Delivery module (SaaS step 5 — E2). The THIRD workspace type (T001 as
 * solution provider), ADDITIVE. Reuses:
 *  - RecordsModule         → attachments (RecordDocument subjectType=Engagement)
 *  - LaunchFactoryClient   → the Launch Factory (customer tenant provisioning at
 *                            GO_LIVE — no new engine, no dual-write), called over
 *                            HTTP since Phase 1.5 Stage B split Delivery and the
 *                            platform's launch module into separate processes.
 *  - the shared RLS XofficePrismaService (tenant-scoped, X.Office's own
 *    database — Phase 1.5 Stage C) + XofficeTenantScopeInterceptor.
 */
@Module({
  imports: [XofficePrismaModule, RecordsModule],
  controllers: [EngagementsController],
  providers: [EngagementsService, LaunchFactoryClient, XofficeTenantScopeInterceptor],
  exports: [EngagementsService],
})
export class DeliveryModule {}
