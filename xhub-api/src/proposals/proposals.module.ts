import { Module } from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { ProposalsController } from './proposals.controller';
import { XofficePrismaModule } from '../xoffice-prisma/xoffice-prisma.module';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';

/** Proposal/Quotation module (Phase 2, BO-0204/BO-0205). X.Office-only, additive. */
@Module({
  imports: [XofficePrismaModule],
  controllers: [ProposalsController],
  providers: [ProposalsService, XofficeTenantScopeInterceptor],
  exports: [ProposalsService],
})
export class ProposalsModule {}
