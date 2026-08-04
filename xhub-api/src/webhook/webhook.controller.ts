import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { WebhookService } from './webhook.service';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { TenantScopeInterceptor } from '../common/tenant-scope.interceptor';
import { WEBHOOK_ID_HEADER, WEBHOOK_SIGNATURE_HEADER } from './hmac.util';
import { RequirePermission } from '../auth/require-permission.decorator';

/**
 * Webhook inbound + outbox + reconcile API (Mục 8b). Tenant-scoped handlers are
 * wrapped in withTenant by TenantScopeInterceptor; `dispatchOutbox` is a
 * CROSS-tenant sweep and is skipped by the interceptor (SKIP_HANDLERS), managing
 * its own withBypass inside the service. Ops triggers (reconcile/dispatch)
 * gated by `platform.webhook.manage` — Security audit 2026-08-04, previously
 * 0/6 routes had any permission gate. `receive()` (inbound external webhook)
 * is intentionally NOT @RequirePermission-gated — the caller is an external
 * system with no XHub identity; its security boundary is the HMAC signature
 * check inside WebhookService.receive() (401 on mismatch), not RBAC.
 * `enqueueOutbox` (cross-process, Stage C.5) stays open — the caller always
 * carries a real actor's own tenant/user identity and only ever writes a
 * notification scoped to that same tenant, so it's no more privileged than
 * the actor's own request that triggered it.
 */
@Controller('api/webhooks')
@UseInterceptors(TenantScopeInterceptor)
export class WebhookController {
  constructor(private readonly webhook: WebhookService) {}

  // Static routes declared before the `:source` param route.
  @Post('reconcile')
  @RequirePermission('platform.webhook.manage')
  reconcile(@Identity() id: RequestIdentity) {
    return this.webhook.reconcile(id.tenantId);
  }

  @Post('dispatch')
  @RequirePermission('platform.webhook.manage')
  dispatchOutbox(@Query('tenantId') tenantId: string) {
    // Manual/tests: ignore backoff so retries drain deterministically.
    return this.webhook.dispatch({ ignoreBackoff: true, tenantId: tenantId || undefined });
  }

  @Get('events')
  events(@Identity() id: RequestIdentity) {
    return this.webhook.listEvents(id.tenantId);
  }

  @Get('outbox')
  outbox(@Query('status') status: string, @Identity() id: RequestIdentity) {
    return this.webhook.listOutbox(id.tenantId, status || undefined);
  }

  /** Cross-process enqueue (Stage C.5 — see WebhookService.enqueueOutbox). */
  @Post('outbox')
  enqueueOutbox(
    @Body() body: { aggregateType: string; aggregateId: string; eventType: string; payload?: Record<string, unknown> },
    @Identity() id: RequestIdentity,
  ) {
    return this.webhook.enqueueOutbox(id.tenantId, body.aggregateType, body.aggregateId, body.eventType, body.payload ?? {});
  }

  @Post(':source')
  receive(
    @Param('source') source: string,
    @Req() req: RawBodyRequest<Request>,
    @Body() body: Record<string, any>,
    @Identity() id: RequestIdentity,
  ) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(body ?? {}), 'utf8');
    const signature = req.header(WEBHOOK_SIGNATURE_HEADER) ?? undefined;
    const headerEventId = req.header(WEBHOOK_ID_HEADER) ?? undefined;
    return this.webhook.receive(id.tenantId, {
      source,
      rawBody: raw,
      parsed: body ?? {},
      signature,
      headerEventId,
    });
  }
}
