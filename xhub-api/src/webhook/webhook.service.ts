import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { verifySignature } from './hmac.util';

interface InboundInput {
  source: string;
  rawBody: Buffer;
  parsed: Record<string, any>;
  signature?: string;
  headerEventId?: string;
}

/**
 * WebhookService — inbound webhook intake + transactional outbox + reconciliation
 * (Mục 8b).
 *
 * Inbound (receive): runs inside the caller's withTenant(tenantId) tx. It
 *  1) verifies the HMAC signature (bad → 401, no secret persisted);
 *  2) dedupes by (tenantId, source, externalId) — a replay returns the stored
 *     event and enqueues NOTHING;
 *  3) records the WebhookEvent AND enqueues an OutboxEvent in the SAME
 *     transaction (transactional outbox — no dual-write).
 *
 * Dispatch (deliver): cross-tenant scheduler sweep under withBypass. Marks
 * pending rows sent, or retries with exponential backoff up to maxAttempts, then
 * failed. A per-event test hook `payload.__failUntilAttempt = N` forces failure
 * until the Nth attempt (mirrors controlplane's __failUntilAttempt).
 *
 * Reconcile (audit): per-tenant read-only drift report between outbox intents
 * and delivered state → { consistent, issues } (mirrors controlplane.reconcile).
 */
@Injectable()
export class WebhookService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.db;
  }

  // ---- inbound --------------------------------------------------------------
  async receive(tenantId: string, input: InboundInput) {
    if (!verifySignature(input.rawBody, input.signature)) {
      throw new UnauthorizedException('invalid webhook signature');
    }

    const externalId =
      input.headerEventId?.trim() ||
      (typeof input.parsed?.id === 'string' ? input.parsed.id : undefined) ||
      (typeof input.parsed?.eventId === 'string' ? input.parsed.eventId : undefined);
    if (!externalId) {
      throw new BadRequestException('webhook event id is required (body.id or x-webhook-id)');
    }
    const eventType =
      (typeof input.parsed?.type === 'string' && input.parsed.type) ||
      (typeof input.parsed?.eventType === 'string' && input.parsed.eventType) ||
      null;

    // Dedup by (tenantId, source, externalId) — idempotent replay.
    const existing = await this.db.webhookEvent.findUnique({
      where: {
        tenantId_source_externalId: { tenantId, source: input.source, externalId },
      },
    });
    if (existing) {
      return { deduped: true, event: existing };
    }

    // Record the inbound event.
    const event = await this.db.webhookEvent.create({
      data: {
        tenantId,
        source: input.source,
        externalId,
        eventType,
        payload: input.parsed as any,
        signatureValid: true,
        status: 'received',
      },
    });

    // Same-transaction outbox enqueue (transactional outbox, no dual-write).
    const outbox = await this.db.outboxEvent.create({
      data: {
        tenantId,
        aggregateType: 'WebhookEvent',
        aggregateId: event.id,
        eventType: `webhook.${input.source}.${eventType ?? 'received'}`,
        payload: input.parsed as any,
        status: 'pending',
        attempts: 0,
        nextAttemptAt: new Date(),
      },
    });

    // Inbound handling done (recorded + enqueued).
    const processed = await this.db.webhookEvent.update({
      where: { id: event.id },
      data: { status: 'processed', processedAt: new Date() },
    });

    return { deduped: false, event: processed, outboxId: outbox.id };
  }

  // ---- outbox dispatch (cross-tenant sweep) --------------------------------
  /**
   * Deliver pending outbox events. Cross-tenant: runs under withBypass. In the
   * scheduler path, backoff is respected (nextAttemptAt gate); the manual
   * endpoint passes ignoreBackoff so a test can drain retries deterministically.
   */
  async dispatch(opts?: { ignoreBackoff?: boolean; tenantId?: string; limit?: number }) {
    return this.prisma.withBypass(async () => {
      const now = new Date();
      const pending = await this.db.outboxEvent.findMany({
        where: {
          status: 'pending',
          ...(opts?.tenantId ? { tenantId: opts.tenantId } : {}),
          ...(opts?.ignoreBackoff
            ? {}
            : { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }),
        },
        orderBy: { createdAt: 'asc' },
        take: opts?.limit ?? 100,
      });

      let sent = 0;
      let retried = 0;
      let failed = 0;
      for (const ev of pending) {
        const attempt = ev.attempts + 1;
        const payload = (ev.payload ?? {}) as Record<string, any>;
        const failUntil = Number(payload.__failUntilAttempt ?? 0);
        const shouldFail = failUntil > 0 && attempt < failUntil;

        if (!shouldFail) {
          await this.db.outboxEvent.update({
            where: { id: ev.id },
            data: { status: 'sent', attempts: attempt, sentAt: new Date(), lastError: null },
          });
          sent++;
        } else if (attempt >= ev.maxAttempts) {
          await this.db.outboxEvent.update({
            where: { id: ev.id },
            data: {
              status: 'failed',
              attempts: attempt,
              lastError: `delivery failed after ${attempt} attempts`,
            },
          });
          failed++;
        } else {
          // backoff: 2^attempt seconds
          const next = new Date(Date.now() + Math.pow(2, attempt) * 1000);
          await this.db.outboxEvent.update({
            where: { id: ev.id },
            data: {
              status: 'pending',
              attempts: attempt,
              nextAttemptAt: next,
              lastError: `transient delivery failure (attempt ${attempt})`,
            },
          });
          retried++;
        }
      }
      return { scanned: pending.length, sent, retried, failed };
    });
  }

  // ---- reads ----------------------------------------------------------------
  listEvents(tenantId: string) {
    return this.db.webhookEvent.findMany({ where: { tenantId }, orderBy: { receivedAt: 'desc' } });
  }

  listOutbox(tenantId: string, status?: string) {
    return this.db.outboxEvent.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---- reconciliation -------------------------------------------------------
  /**
   * Read-only drift report between outbox intents and delivered state for one
   * tenant. Issues: a processed webhook with no outbox row; still-pending outbox
   * (undelivered drift); failed outbox (dead-letter). consistent = no issues.
   */
  async reconcile(tenantId: string) {
    const [events, outbox] = await Promise.all([
      this.db.webhookEvent.findMany({ where: { tenantId } }),
      this.db.outboxEvent.findMany({ where: { tenantId } }),
    ]);

    const outboxByAggregate = new Set(
      outbox.filter((o) => o.aggregateType === 'WebhookEvent').map((o) => o.aggregateId),
    );

    const issues: { type: string; id: string; detail?: string }[] = [];
    for (const e of events) {
      if (e.status === 'processed' && !outboxByAggregate.has(e.id)) {
        issues.push({ type: 'processed_webhook_without_outbox', id: e.id });
      }
    }
    for (const o of outbox) {
      if (o.status === 'pending') {
        issues.push({ type: 'outbox_pending', id: o.id, detail: `attempts=${o.attempts}` });
      } else if (o.status === 'failed') {
        issues.push({ type: 'outbox_failed', id: o.id, detail: o.lastError ?? undefined });
      }
    }

    const sent = outbox.filter((o) => o.status === 'sent').length;
    const pending = outbox.filter((o) => o.status === 'pending').length;
    const failed = outbox.filter((o) => o.status === 'failed').length;

    return {
      tenantId,
      webhookEvents: events.length,
      outboxEvents: outbox.length,
      sent,
      pending,
      failed,
      consistent: issues.length === 0,
      issues,
    };
  }
}
