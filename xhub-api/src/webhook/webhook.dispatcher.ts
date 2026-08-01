import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { WebhookService } from './webhook.service';

/**
 * Outbox dispatcher (Mục 8b). Sweeps pending OutboxEvents every ~15s and
 * delivers them with retry/backoff. The actual logic lives in
 * WebhookService.dispatch so the same path is reachable via
 * POST /api/webhooks/dispatch for deterministic tests (backoff-gated here,
 * ignoreBackoff there).
 */
@Injectable()
export class OutboxDispatcher {
  private readonly log = new Logger('OutboxDispatcher');

  constructor(private readonly webhook: WebhookService) {}

  @Interval(15_000)
  async sweep(): Promise<void> {
    try {
      const res = await this.webhook.dispatch();
      if (res.sent || res.retried || res.failed) {
        this.log.log(`dispatch: sent=${res.sent} retried=${res.retried} failed=${res.failed}`);
      }
    } catch (e) {
      this.log.error(`dispatch failed: ${(e as Error).message}`);
    }
  }
}
