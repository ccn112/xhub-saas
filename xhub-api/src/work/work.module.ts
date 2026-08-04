import { Module } from '@nestjs/common';
import { WorkService } from './work.service';
import { WorkController } from './work.controller';
import { WorkProjectsService } from './projects/work-projects.service';
import { WorkProjectsController } from './projects/work-projects.controller';
import { WorkStatsService } from './stats/work-stats.service';
import { WorkStatsController } from './stats/work-stats.controller';
import { WorkPortfolioController } from './stats/work-portfolio.controller';
import { XofficePrismaModule } from '../xoffice-prisma/xoffice-prisma.module';
import { RecordsModule } from '../records/records.module';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';

/**
 * Work module (X.Office Work & PM v2 — W1, NativeWorkItem core). Additive.
 * Reuses:
 *  - RecordsModule → attachments/evidence (RecordDocument subjectType=WorkItem)
 *  - AssignmentResolver (responsibility routing) + IdentityService
 *    (visibility-tier `work.view.full` decision) — global providers from
 *    IdentityModule.forPlatform()/forXoffice() (Stage C.5), not imported here.
 *  - the shared RLS XofficePrismaService (tenant-scoped) + XOffice XofficeTenantScopeInterceptor.
 */
@Module({
  imports: [XofficePrismaModule, RecordsModule],
  controllers: [WorkController, WorkProjectsController, WorkStatsController, WorkPortfolioController],
  providers: [WorkService, WorkProjectsService, WorkStatsService, XofficeTenantScopeInterceptor],
  exports: [WorkService, WorkProjectsService],
})
export class WorkModule {}
