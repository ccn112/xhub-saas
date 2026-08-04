import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseInterceptors } from '@nestjs/common';
import { WorkProjectsService } from './work-projects.service';
import { RequirePermission } from '../../auth/require-permission.decorator';
import { Identity } from '../../auth/identity.decorator';
import type { RequestIdentity } from '../../auth/identity.types';
import { XofficeTenantScopeInterceptor } from '../../common/xoffice-tenant-scope.interceptor';

/**
 * ExecutionProject API (X.Office Work v2 — W2). Tenant-scoped via
 * XofficeTenantScopeInterceptor (prisma.withTenant → RLS). Writes gated by
 * `work.project.*` / `work.item.update`; the detail/gantt reads let the SERVICE
 * decide FULL vs SUMMARY per actor (CoordinationShare — owner requirement #1).
 */
@Controller('api/work/projects')
@UseInterceptors(XofficeTenantScopeInterceptor)
export class WorkProjectsController {
  constructor(private readonly svc: WorkProjectsService) {}

  private tenant(id: RequestIdentity): string {
    return id.tenantId ?? 'tenant-xtech';
  }
  private user(id: RequestIdentity): string {
    return id.userId ?? 'user-nam';
  }
  private parseDimensions(raw?: string): Record<string, string> | undefined {
    if (!raw) return undefined;
    try {
      const p = JSON.parse(raw);
      return p && typeof p === 'object' ? p : undefined;
    } catch {
      return undefined;
    }
  }

  @Post()
  @RequirePermission('work.project.create')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(this.tenant(id), this.user(id), body);
  }

  @Get()
  list(
    @Identity() id: RequestIdentity,
    @Query('status') status?: string,
    @Query('projectKind') projectKind?: string,
    @Query('health') health?: string,
    @Query('q') q?: string,
    @Query('tags') tags?: string,
    @Query('dimensions') dimensions?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.svc.list(this.tenant(id), {
      status,
      projectKind,
      health,
      q,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      dimensions: this.parseDimensions(dimensions),
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get(':id')
  get(@Param('id') id: string, @Identity() ident: RequestIdentity) {
    return this.svc.get(this.tenant(ident), this.user(ident), id);
  }

  @Patch(':id')
  @RequirePermission('work.project.manage')
  update(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.update(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Post(':id/recompute')
  @RequirePermission('work.project.manage')
  recompute(@Param('id') id: string, @Identity() ident: RequestIdentity) {
    return this.svc.recompute(this.tenant(ident), this.user(ident), id);
  }

  // ---- WBS attach -----------------------------------------------------------
  @Post(':id/items')
  @RequirePermission('work.item.update')
  attach(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.attachItems(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  // ---- coordination gantt (summary/full read) -------------------------------
  @Get(':id/gantt')
  gantt(@Param('id') id: string, @Query('view') view: string | undefined, @Identity() ident: RequestIdentity) {
    return this.svc.coordinationGantt(this.tenant(ident), this.user(ident), id);
  }

  // ---- dependencies ---------------------------------------------------------
  @Get(':id/dependencies')
  listDeps(@Param('id') id: string, @Identity() ident: RequestIdentity) {
    return this.svc.listDependencies(this.tenant(ident), id);
  }

  @Post(':id/dependencies')
  @RequirePermission('work.item.update')
  addDep(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.addDependency(this.tenant(ident), this.user(ident), body ?? {});
  }

  @Delete('dependencies/:depId')
  @RequirePermission('work.item.update')
  removeDep(@Param('depId') depId: string, @Identity() ident: RequestIdentity) {
    return this.svc.removeDependency(this.tenant(ident), this.user(ident), depId);
  }

  // ---- baseline -------------------------------------------------------------
  @Get(':id/baselines')
  listBaselines(@Param('id') id: string, @Identity() ident: RequestIdentity) {
    return this.svc.listBaselines(this.tenant(ident), id);
  }

  @Post(':id/baseline')
  @RequirePermission('work.project.baseline')
  baseline(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.createBaseline(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Post(':id/rebaseline')
  @RequirePermission('work.project.baseline')
  rebaseline(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.rebaseline(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  // ---- roles ----------------------------------------------------------------
  @Get(':id/roles')
  listRoles(@Param('id') id: string, @Identity() ident: RequestIdentity) {
    return this.svc.listRoles(this.tenant(ident), id);
  }

  @Post(':id/roles')
  @RequirePermission('work.project.manage')
  assignRole(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.assignRole(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  // ---- coordination shares --------------------------------------------------
  @Get(':id/shares')
  listShares(@Param('id') id: string, @Identity() ident: RequestIdentity) {
    return this.svc.listShares(this.tenant(ident), id);
  }

  @Post(':id/shares')
  @RequirePermission('work.project.manage')
  createShare(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.createShare(this.tenant(ident), this.user(ident), id, body ?? {});
  }
}
