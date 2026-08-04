import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, firstValueFrom } from 'rxjs';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';
import type { RequestIdentity } from '../auth/identity.types';

/**
 * Same wrapping as `TenantScopeInterceptor` (`prisma.withTenant(...)` around
 * every request handler), but bound to `XofficePrismaService` — Phase 1.5
 * Stage C. Controllers whose underlying service has been migrated to the
 * X.Office database use THIS interceptor instead, so the RLS session var
 * (`app.current_tenant`) gets set on the right connection/DB. Same
 * SKIP_HANDLERS list as the platform-side interceptor (cross-tenant handlers
 * manage their own withTenant/withBypass).
 */
const SKIP_HANDLERS = new Set(['schedulerTick', 'aiDraft', 'restore', 'dispatchOutbox', 'launchTenant']);

@Injectable()
export class XofficeTenantScopeInterceptor implements NestInterceptor {
  constructor(private readonly prisma: XofficePrismaService) {}

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
