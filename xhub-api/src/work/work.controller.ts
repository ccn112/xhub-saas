import { Body, Controller, Get, Param, Patch, Post, Query, UseInterceptors } from '@nestjs/common';
import { WorkService } from './work.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';

/**
 * NativeWorkItem API (X.Office Work v2 — W1). Tenant-scoped via
 * XofficeTenantScopeInterceptor (prisma.withTenant → RLS). create/update/status/assign/
 * progress are gated by `work.item.*` through the global PermissionGuard;
 * reads are open (the SERVICE decides FULL vs SUMMARY per actor — owner req #1).
 */
@Controller('api/work/items')
@UseInterceptors(XofficeTenantScopeInterceptor)
export class WorkController {
  constructor(private readonly svc: WorkService) {}

  private tenant(id: RequestIdentity): string {
    return id.tenantId ?? 'tenant-xtech';
  }
  private user(id: RequestIdentity): string {
    return id.userId ?? 'user-nam';
  }

  private parseDimensions(raw?: string): Record<string, string> | undefined {
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : undefined;
    } catch {
      // also accept key:value,key2:value2
      const out: Record<string, string> = {};
      for (const pair of raw.split(',')) {
        const [k, v] = pair.split(':');
        if (k && v) out[k.trim()] = v.trim();
      }
      return Object.keys(out).length ? out : undefined;
    }
  }

  @Post()
  @RequirePermission('work.item.create')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(this.tenant(id), this.user(id), body);
  }

  @Get('dimensions')
  dimensions(@Identity() id: RequestIdentity) {
    return this.svc.listDimensions(this.tenant(id));
  }

  @Get()
  list(
    @Identity() id: RequestIdentity,
    @Query('scope') scope?: 'mine' | 'assigned' | 'created' | 'all',
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('projectId') projectId?: string,
    @Query('parentId') parentId?: string,
    @Query('q') q?: string,
    @Query('tags') tags?: string,
    @Query('dimensions') dimensions?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.svc.list(this.tenant(id), this.user(id), {
      scope,
      status,
      type,
      projectId,
      parentId,
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
  @RequirePermission('work.item.update')
  update(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.update(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Post(':id/status')
  @RequirePermission('work.item.update')
  status(@Param('id') id: string, @Body() body: { to?: string; status?: string }, @Identity() ident: RequestIdentity) {
    return this.svc.changeStatus(this.tenant(ident), this.user(ident), id, body?.to ?? body?.status ?? '');
  }

  @Post(':id/schedule')
  @RequirePermission('work.item.update')
  schedule(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.reschedule(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Post(':id/assign')
  @RequirePermission('work.item.assign')
  assign(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.assign(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Post(':id/progress')
  @RequirePermission('work.item.update')
  progress(@Param('id') id: string, @Body() body: { progressPercent?: number }, @Identity() ident: RequestIdentity) {
    return this.svc.setProgress(this.tenant(ident), this.user(ident), id, body?.progressPercent ?? 0);
  }

  @Post(':id/comment')
  @RequirePermission('work.item.comment')
  comment(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.addComment(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Post(':id/checklist')
  @RequirePermission('work.item.update')
  checklist(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.addChecklistItem(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Post(':id/checklist/:itemId/toggle')
  @RequirePermission('work.item.update')
  toggleChecklist(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: { done?: boolean },
    @Identity() ident: RequestIdentity,
  ) {
    return this.svc.toggleChecklistItem(this.tenant(ident), this.user(ident), id, itemId, !!body?.done);
  }

  @Post(':id/attachments')
  @RequirePermission('work.item.update')
  attachments(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.addAttachment(this.tenant(ident), this.user(ident), id, body ?? {});
  }
}
