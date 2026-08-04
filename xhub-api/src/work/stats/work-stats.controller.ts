import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { WorkStatsService } from './work-stats.service';
import { RequirePermission } from '../../auth/require-permission.decorator';
import { Identity } from '../../auth/identity.decorator';
import type { RequestIdentity } from '../../auth/identity.types';
import { TenantScopeInterceptor } from '../../common/tenant-scope.interceptor';

/**
 * Work statistics API (X.Office Work v2 — W3, owner requirement #2). Query-only,
 * gated `work.report.read` (soft unless AUTH_ENFORCE), tenant-scoped via
 * TenantScopeInterceptor → RLS. Returns a deterministic cross-tab grouped by any
 * tag/dimension/facet, optionally pivoted by a second axis.
 */
@Controller('api/work/stats')
@UseInterceptors(TenantScopeInterceptor)
export class WorkStatsController {
  constructor(private readonly svc: WorkStatsService) {}

  private tenant(id: RequestIdentity): string {
    return id.tenantId ?? 'tenant-xtech';
  }
  private parseDimensions(raw?: string): Record<string, string> | undefined {
    if (!raw) return undefined;
    try {
      const p = JSON.parse(raw);
      return p && typeof p === 'object' ? p : undefined;
    } catch {
      const out: Record<string, string> = {};
      for (const pair of raw.split(',')) {
        const [k, v] = pair.split(':');
        if (k && v) out[k.trim()] = v.trim();
      }
      return Object.keys(out).length ? out : undefined;
    }
  }

  @Get()
  @RequirePermission('work.report.read')
  stats(
    @Identity() id: RequestIdentity,
    @Query('groupBy') groupBy: string,
    @Query('col') col?: string,
    @Query('metric') metric?: 'count' | 'progress' | 'overdue',
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('priority') priority?: string,
    @Query('projectId') projectId?: string,
    @Query('tags') tags?: string,
    @Query('dimensions') dimensions?: string,
  ) {
    return this.svc.stats(this.tenant(id), {
      groupBy,
      col,
      metric,
      status,
      type,
      priority,
      projectId,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      dimensions: this.parseDimensions(dimensions),
    });
  }
}
