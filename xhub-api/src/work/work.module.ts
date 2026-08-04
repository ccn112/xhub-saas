import { Module } from '@nestjs/common';
import { WorkService } from './work.service';
import { WorkController } from './work.controller';
import { WorkProjectsService } from './projects/work-projects.service';
import { WorkProjectsController } from './projects/work-projects.controller';
import { WorkStatsService } from './stats/work-stats.service';
import { WorkStatsController } from './stats/work-stats.controller';
import { WorkPortfolioController } from './stats/work-portfolio.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RecordsModule } from '../records/records.module';
import { IdentityModule } from '../identity/identity.module';
import { TenantScopeInterceptor } from '../common/tenant-scope.interceptor';

/**
 * Work module (X.Office Work & PM v2 — W1, NativeWorkItem core). Additive.
 * Reuses:
 *  - RecordsModule  → attachments/evidence (RecordDocument subjectType=WorkItem)
 *  - IdentityModule → AssignmentResolver (responsibility routing) + IdentityService
 *    (visibility-tier `work.view.full` decision)
 *  - the shared RLS PrismaService (tenant-scoped) + XOffice TenantScopeInterceptor.
 */
@Module({
  imports: [PrismaModule, RecordsModule, IdentityModule],
  controllers: [WorkController, WorkProjectsController, WorkStatsController, WorkPortfolioController],
  providers: [WorkService, WorkProjectsService, WorkStatsService, TenantScopeInterceptor],
  exports: [WorkService, WorkProjectsService],
})
export class WorkModule {}
