import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { RevenueKpiService } from './revenue-kpi.service';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';

/** Revenue/Pipeline KPI API (Phase 2, BO-0209). Open read (dashboard). */
@Controller('api/revenue-kpi')
@UseInterceptors(XofficeTenantScopeInterceptor)
export class RevenueKpiController {
  constructor(private readonly svc: RevenueKpiService) {}

  @Get()
  get(@Identity() id: RequestIdentity) {
    return this.svc.get(id.tenantId ?? 'tenant-xtech');
  }
}
