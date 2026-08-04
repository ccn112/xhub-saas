import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestIdentity } from '../auth/identity.types';

/**
 * Wraps every request handler in `prisma.withTenant(identity.tenantId)` so all
 * reads/writes it performs run inside a transaction that SET LOCAL
 * app.current_tenant — activating Postgres RLS scoping for the whole handler
 * (controller → service → private helpers → notification service all join the
 * same tenant transaction via `prisma.db`).
 *
 * Identity is resolved earlier by the global IdentityGuard (guards run before
 * interceptors), so `req.identity.tenantId` is available here.
 *
 * Lives in `common/` (not `xoffice/`) because every module in the app uses it,
 * both XHub-Platform (controlplane/mdm/backup/webhook) and X.Office-Business
 * (xoffice/requests/tickets/bookings/directives/announcements/records/work/
 * manage/people/ioc/delivery) — see the XHub/X.Office boundary-cleanup plan in
 * `docs/implementation/xoffice-ai/IMPLEMENTATION_PLAN.md`, Phase 1.5 Stage A.
 *
 * SKIPPED handlers:
 *  - `schedulerTick`: the sweep is intentionally CROSS-tenant and manages its
 *    own `withBypass` inside the service; wrapping it in one tenant would hide
 *    other tenants' due tasks.
 *  - `aiDraft`: performs an external LLM call and touches no tenant table;
 *    keeping it out of a DB transaction avoids holding a connection open.
 *
 * The in-code tenantId filters in the service are kept unchanged as
 * defense-in-depth (belt-and-suspenders with RLS).
 */
// 'restore' (backup module) is CROSS-tenant by design: it reads the source
// tenant's backup, decrypts + remaps identity, and writes into a DIFFERENT
// (sandbox) tenant. It manages its own withBypass / explicit tenantId scoping
// (a re-entrant withTenant here would pin it to the source tenant and block the
// cross-tenant write), so it is skipped like schedulerTick.
// 'dispatchOutbox' (webhook module) is a CROSS-tenant outbox sweep: it delivers
// pending OutboxEvents across ALL tenants under its own withBypass. Wrapping it
// in one tenant would hide other tenants' pending events, so it is skipped too.
// 'launchTenant' (delivery module) triggers the Tenant Launch Factory, which is
// CROSS-tenant by design (it opens its own withBypass / withTenant(target) per
// step). A re-entrant outer withTenant here would neuter those (Prisma forbids
// nested tx, so the helpers no-op when a context is open), pinning the launch to
// T001 and breaking isolation. The delivery service opens its own withTenant for
// the engagement reads/writes, so it is skipped like restore/dispatchOutbox.
const SKIP_HANDLERS = new Set(['schedulerTick', 'aiDraft', 'restore', 'dispatchOutbox', 'launchTenant']);

@Injectable()
export class TenantScopeInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handlerName = context.getHandler().name;
    const req = context.switchToHttp().getRequest<{ identity?: RequestIdentity }>();
    const tenantId = req?.identity?.tenantId;

    if (SKIP_HANDLERS.has(handlerName) || !tenantId) {
      return next.handle();
    }

    return from(
      this.prisma.withTenant(tenantId, () => firstValueFrom(next.handle())),
    );
  }
}
