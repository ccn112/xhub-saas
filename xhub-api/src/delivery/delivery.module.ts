import { Module } from '@nestjs/common';
import { EngagementsService } from './engagements.service';
import { EngagementsController } from './engagements.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RecordsModule } from '../records/records.module';
import { TenantLaunchModule } from '../platform/launch/tenant-launch.module';
import { TenantScopeInterceptor } from '../common/tenant-scope.interceptor';

/**
 * Solution Delivery module (SaaS step 5 — E2). The THIRD workspace type (T001 as
 * solution provider), ADDITIVE. Reuses:
 *  - RecordsModule       → attachments (RecordDocument subjectType=Engagement)
 *  - TenantLaunchModule  → the Launch Factory (customer tenant provisioning at
 *                          GO_LIVE — no new engine, no dual-write)
 *  - the shared RLS PrismaService (tenant-scoped) + XOffice TenantScopeInterceptor.
 */
@Module({
  imports: [PrismaModule, RecordsModule, TenantLaunchModule],
  controllers: [EngagementsController],
  providers: [EngagementsService, TenantScopeInterceptor],
  exports: [EngagementsService],
})
export class DeliveryModule {}
