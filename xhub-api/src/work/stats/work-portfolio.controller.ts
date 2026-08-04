import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { WorkProjectsService } from '../projects/work-projects.service';
import { RequirePermission } from '../../auth/require-permission.decorator';
import { Identity } from '../../auth/identity.decorator';
import type { RequestIdentity } from '../../auth/identity.types';
import { TenantScopeInterceptor } from '../../common/tenant-scope.interceptor';

/**
 * Portfolio cockpit API (X.Office Work v2 — W3). Query-only, gated
 * `work.portfolio.read` (soft unless AUTH_ENFORCE), tenant-scoped via
 * TenantScopeInterceptor → RLS. Returns a read-only roll-up across all
 * ExecutionProjects: health/status buckets + per-project progress/overdue/blocked.
 */
@Controller('api/work/portfolio')
@UseInterceptors(TenantScopeInterceptor)
export class WorkPortfolioController {
  constructor(private readonly svc: WorkProjectsService) {}

  private tenant(id: RequestIdentity): string {
    return id.tenantId ?? 'tenant-xtech';
  }

  @Get()
  @RequirePermission('work.portfolio.read')
  portfolio(
    @Identity() id: RequestIdentity,
    @Query('status') status?: string,
    @Query('projectKind') projectKind?: string,
  ) {
    return this.svc.portfolio(this.tenant(id), { status, projectKind });
  }
}
