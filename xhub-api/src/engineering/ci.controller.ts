import { Body, Controller, Get, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { CiService } from './ci.service';
import { verifySignature, WEBHOOK_SIGNATURE_HEADER } from '../webhook/hmac.util';

/**
 * CI/build callback ingestion (DG-06,
 * docs/implementation/engineering-hub/INTEGRATION_CONTRACT_CI.md). Platform-
 * wide (no tenant), so unlike WebhookController this never runs under
 * TenantScopeInterceptor. `callback()` is intentionally NOT
 * @RequirePermission-gated — the caller is an external CI system with no
 * XHub identity; its security boundary is the HMAC signature check below
 * (401 on mismatch), mirroring the exact justification already used for
 * WebhookController.receive(). Reuses the SAME hmac.util.ts helpers and env
 * (WEBHOOK_SIGNING_SECRET) as the tenant webhook intake — a single shared
 * secret across all CI producers is a stated MVP simplification (see
 * INTEGRATION_CONTRACT_CI.md "Known limitations"), not a design endpoint.
 */
@Controller('api/engineering/ci')
export class CiController {
  constructor(private readonly ci: CiService) {}

  @Post('callback')
  callback(@Req() req: RawBodyRequest<Request>, @Body() body: Record<string, any>) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(body ?? {}), 'utf8');
    const signature = req.header(WEBHOOK_SIGNATURE_HEADER) ?? undefined;
    if (!verifySignature(raw, signature)) {
      // eslint-disable-next-line no-console
      console.warn(`[engineering-ci] rejected forged/missing signature for productCode=${body?.productCode ?? '?'}`);
      throw new UnauthorizedException('invalid webhook signature');
    }
    return this.ci.recordBuild(body as any);
  }

  @Get('builds')
  builds(@Query('productId') productId: string, @Query('status') status?: string, @Query('source') source?: string) {
    return this.ci.list(productId, { status, source });
  }
}
