import { Module } from '@nestjs/common';
import { OpportunitiesService } from './opportunities.service';
import { OpportunitiesController } from './opportunities.controller';
import { XofficePrismaModule } from '../xoffice-prisma/xoffice-prisma.module';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';

/** Opportunity pipeline module (Phase 2, BO-0202). X.Office-only, additive. */
@Module({
  imports: [XofficePrismaModule],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService, XofficeTenantScopeInterceptor],
  exports: [OpportunitiesService],
})
export class OpportunitiesModule {}
