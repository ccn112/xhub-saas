import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { XofficePrismaModule } from '../xoffice-prisma/xoffice-prisma.module';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';

/**
 * Customer/Contact module (Phase 2 — Revenue & Contract MVP, BO-0201,
 * docs/implementation/xoffice-ai/). Additive, X.Office-only (registered in
 * xoffice-app.module.ts, never platform-app.module.ts — this is tenant
 * business data, the opposite scope from engineering-governance). Later
 * slices (Opportunity BO-0202, Catalog BO-0203, Proposal/Contract
 * BO-0204..0208) will live in their own modules, referencing Customer by
 * plain string id — not part of this pass.
 */
@Module({
  imports: [XofficePrismaModule],
  controllers: [CustomersController],
  providers: [CustomersService, XofficeTenantScopeInterceptor],
  exports: [CustomersService],
})
export class CustomersModule {}
