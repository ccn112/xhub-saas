import { Body, Controller, Get, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { TenantScopeInterceptor } from '../xoffice/tenant-scope.interceptor';

/**
 * Resource Booking API (PH-02d — NX-027). Tenant-scoped via
 * TenantScopeInterceptor (prisma.withTenant). Booking create is gated by
 * `request.create` (any employee can book). Manage actions (approve/reject +
 * adding a bookable resource) → `booking.manage`. List/detail/lifecycle by the
 * requester (cancel/check-in/check-out) + comment/attachment are open (server
 * still scopes by tenant). The core rule — CONFLICT (409 on overlap) — lives in
 * the service and fires on both create and approve.
 */
@Controller('api')
@UseInterceptors(TenantScopeInterceptor)
export class BookingsController {
  constructor(private readonly svc: BookingsService) {}

  private tenant(id: RequestIdentity): string {
    return id.tenantId ?? 'tenant-xtech';
  }
  private user(id: RequestIdentity): string {
    return id.userId ?? 'user-nam';
  }

  // ---- bookable resources ---------------------------------------------------
  @Get('bookable-resources')
  listResources(
    @Identity() id: RequestIdentity,
    @Query('type') type?: string,
    @Query('q') q?: string,
  ) {
    return this.svc.listResources(this.tenant(id), { type, q });
  }

  @Post('bookable-resources')
  @RequirePermission('booking.manage')
  createResource(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.createResource(this.tenant(id), this.user(id), body);
  }

  // ---- bookings -------------------------------------------------------------
  @Post('bookings')
  @RequirePermission('request.create')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(this.tenant(id), this.user(id), body);
  }

  @Get('bookings')
  list(
    @Identity() id: RequestIdentity,
    @Query('scope') scope?: 'mine' | 'resource' | 'all',
    @Query('state') state?: string,
    @Query('resourceId') resourceId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.svc.list(this.tenant(id), this.user(id), {
      scope,
      state,
      resourceId,
      from,
      to,
      q,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('bookings/:id')
  get(@Param('id') id: string, @Identity() ident: RequestIdentity) {
    return this.svc.get(this.tenant(ident), id);
  }

  @Post('bookings/:id/approve')
  @RequirePermission('booking.manage')
  approve(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.approve(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Post('bookings/:id/reject')
  @RequirePermission('booking.manage')
  reject(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.transition(this.tenant(ident), this.user(ident), id, 'reject', body ?? {});
  }

  @Post('bookings/:id/cancel')
  cancel(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.cancel(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Post('bookings/:id/check-in')
  checkIn(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.checkIn(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Post('bookings/:id/check-out')
  checkOut(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.checkOut(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Post('bookings/:id/no-show')
  @RequirePermission('booking.manage')
  noShow(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.noShow(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Post('bookings/:id/comment')
  comment(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.comment(this.tenant(ident), this.user(ident), id, body ?? {});
  }

  @Post('bookings/:id/attachments')
  attachment(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.attachment(this.tenant(ident), this.user(ident), id, body ?? {});
  }
}
