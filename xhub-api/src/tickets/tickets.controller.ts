import { Body, Controller, Get, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { TenantScopeInterceptor } from '../common/tenant-scope.interceptor';

/**
 * Service Desk / Ticket API (PH-02c — NX-026). Tenant-scoped via
 * TenantScopeInterceptor (prisma.withTenant). Create is gated by `request.create`
 * (any employee can raise a ticket). Manage actions (triage/assign) → `ticket.manage`;
 * self-assign (claim) → `assign.self`; resolve → `ticket.resolve`; service
 * catalog writes → `service_catalog.manage`. List/detail/comment/attachment are
 * open (server still scopes by tenant); CSAT is requester-only (enforced in svc).
 */
@Controller('api')
@UseInterceptors(TenantScopeInterceptor)
export class TicketsController {
  constructor(private readonly svc: TicketsService) {}

  private tenant(id: RequestIdentity): string {
    return id.tenantId ?? 'tenant-xtech';
  }
  private user(id: RequestIdentity): string {
    return id.userId ?? 'user-nam';
  }

  // ---- service catalog ------------------------------------------------------
  @Get('service-catalog')
  listCatalog(@Identity() id: RequestIdentity) {
    return this.svc.listCatalog(this.tenant(id));
  }

  @Post('service-catalog')
  @RequirePermission('service_catalog.manage')
  createCatalogItem(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.createCatalogItem(this.tenant(id), this.user(id), body);
  }

  // ---- tickets --------------------------------------------------------------
  @Post('tickets')
  @RequirePermission('request.create')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(this.tenant(id), this.user(id), body);
  }

  @Get('tickets')
  list(
    @Identity() id: RequestIdentity,
    @Query('scope') scope?: 'mine' | 'assigned' | 'queue' | 'all',
    @Query('state') state?: string,
    @Query('category') category?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.svc.list(this.tenant(id), this.user(id), {
      scope,
      state,
      category,
      q,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('tickets/:id')
  get(@Param('id') id: string, @Identity() ident: RequestIdentity) {
    return this.svc.get(this.tenant(ident), id);
  }

  @Post('tickets/:id/triage')
  @RequirePermission('ticket.manage')
  triage(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.transition(this.tenant(ident), this.user(ident), id, 'triage', body ?? {});
  }

  @Post('tickets/:id/assign')
  @RequirePermission('ticket.manage')
  assign(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.assign(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Post('tickets/:id/claim')
  @RequirePermission('assign.self')
  claim(@Param('id') id: string, @Identity() ident: RequestIdentity) {
    return this.svc.claim(this.tenant(ident), this.user(ident), id);
  }

  @Post('tickets/:id/start')
  start(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.transition(this.tenant(ident), this.user(ident), id, 'start', body ?? {});
  }

  @Post('tickets/:id/pending')
  pending(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.transition(this.tenant(ident), this.user(ident), id, 'pending', body ?? {});
  }

  @Post('tickets/:id/resume')
  resume(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.transition(this.tenant(ident), this.user(ident), id, 'resume', body ?? {});
  }

  @Post('tickets/:id/resolve')
  @RequirePermission('ticket.resolve')
  resolve(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.resolve(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Post('tickets/:id/close')
  close(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.transition(this.tenant(ident), this.user(ident), id, 'close', body ?? {});
  }

  @Post('tickets/:id/cancel')
  cancel(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.transition(this.tenant(ident), this.user(ident), id, 'cancel', body ?? {});
  }

  @Post('tickets/:id/comment')
  comment(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.comment(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Post('tickets/:id/attachments')
  attachment(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.attachment(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Post('tickets/:id/csat')
  csat(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.csat(this.tenant(ident), this.user(ident), id, body ?? {});
  }
}
