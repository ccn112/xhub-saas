import { Body, Controller, Get, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';

/**
 * Internal Announcement API (PH-02e — NX-028). Tenant-scoped via
 * XofficeTenantScopeInterceptor (prisma.withTenant). Authoring + lifecycle
 * (create/publish/archive/cancel/remind) is gated by `announcement.publish`
 * (= COMM_ADMIN). Recipient actions (read / acknowledge) + list/detail/report are
 * open — every recipient can act (the server still scopes by tenant + receipt).
 * publish fans the audience out into AnnouncementReceipts via the shared
 * AssignmentResolver / identity (never a hardcoded audience).
 */
@Controller('api')
@UseInterceptors(XofficeTenantScopeInterceptor)
export class AnnouncementsController {
  constructor(private readonly svc: AnnouncementsService) {}

  private tenant(id: RequestIdentity): string {
    return id.tenantId ?? 'tenant-xtech';
  }
  private user(id: RequestIdentity): string {
    return id.userId ?? 'user-nam';
  }

  // ---- authoring + lifecycle (COMM_ADMIN) -----------------------------------
  @Post('announcements')
  @RequirePermission('announcement.publish')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(this.tenant(id), this.user(id), body);
  }

  @Get('announcements')
  list(
    @Identity() id: RequestIdentity,
    @Query('scope') scope?: 'mine' | 'for-me' | 'all',
    @Query('state') state?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.svc.list(this.tenant(id), this.user(id), {
      scope,
      state,
      q,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('announcements/:id')
  get(@Param('id') id: string, @Identity() ident: RequestIdentity) {
    return this.svc.get(this.tenant(ident), id, this.user(ident));
  }

  @Get('announcements/:id/report')
  report(@Param('id') id: string, @Identity() ident: RequestIdentity) {
    return this.svc.report(this.tenant(ident), id);
  }

  @Post('announcements/:id/publish')
  @RequirePermission('announcement.publish')
  publish(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.publish(this.tenant(ident), this.user(ident), id);
  }

  @Post('announcements/:id/archive')
  @RequirePermission('announcement.publish')
  archive(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.archive(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Post('announcements/:id/cancel')
  @RequirePermission('announcement.publish')
  cancel(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.cancel(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Post('announcements/:id/remind')
  @RequirePermission('announcement.publish')
  remind(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.remind(this.tenant(ident), this.user(ident), id);
  }

  // ---- recipient actions (any recipient) ------------------------------------
  @Post('announcements/:id/read')
  read(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.read(this.tenant(ident), this.user(ident), id);
  }

  @Post('announcements/:id/acknowledge')
  acknowledge(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.acknowledge(this.tenant(ident), this.user(ident), id);
  }

  @Post('announcements/:id/comment')
  comment(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.comment(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Post('announcements/:id/attachments')
  attachment(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.attachment(this.tenant(ident), this.user(ident), id, body ?? {});
  }
}
