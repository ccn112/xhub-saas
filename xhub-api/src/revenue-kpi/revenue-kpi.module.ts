import { Module } from '@nestjs/common';
import { RevenueKpiService } from './revenue-kpi.service';
import { RevenueKpiController } from './revenue-kpi.controller';
import { XofficePrismaModule } from '../xoffice-prisma/xoffice-prisma.module';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';

/** Revenue/Pipeline KPI module (Phase 2, BO-0209). X.Office-only, additive, read-only. */
@Module({
  imports: [XofficePrismaModule],
  controllers: [RevenueKpiController],
  providers: [RevenueKpiService, XofficeTenantScopeInterceptor],
})
export class RevenueKpiModule {}
