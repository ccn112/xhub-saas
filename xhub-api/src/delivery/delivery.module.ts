import { Module } from '@nestjs/common';
import { EngagementsService } from './engagements.service';
import { EngagementsController } from './engagements.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RecordsModule } from '../records/records.module';
import { LaunchFactoryClient } from './launch-factory.client';
import { TenantScopeInterceptor } from '../common/tenant-scope.interceptor';

/**
 * Solution Delivery module (SaaS step 5 — E2). The THIRD workspace type (T001 as
 * solution provider), ADDITIVE. Reuses:
 *  - RecordsModule         → attachments (RecordDocument subjectType=Engagement)
 *  - LaunchFactoryClient   → the Launch Factory (customer tenant provisioning at
 *                            GO_LIVE — no new engine, no dual-write), called over
 *                            HTTP since Phase 1.5 Stage B split Delivery and the
 *                            platform's launch module into separate processes.
 *  - the shared RLS PrismaService (tenant-scoped) + XOffice TenantScopeInterceptor.
 */
@Module({
  imports: [PrismaModule, RecordsModule],
  controllers: [EngagementsController],
  providers: [EngagementsService, LaunchFactoryClient, TenantScopeInterceptor],
  exports: [EngagementsService],
})
export class DeliveryModule {}
