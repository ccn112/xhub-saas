import { Injectable, InternalServerErrorException } from '@nestjs/common';

/**
 * Cross-process OutboxEvent enqueue (Stage C.5). OutboxEvent stays
 * Platform-only (the dispatcher only ever runs there — see
 * src/common/outbox.ts); once an X.Office module runs on its own physically
 * separate database, it can no longer write that table directly, so this
 * calls `POST /api/webhooks/outbox` instead — same HTTP-seam pattern as
 * `src/delivery/launch-factory.client.ts`.
 */
@Injectable()
export class OutboxHttpClient {
  private readonly base = process.env.PLATFORM_API_URL ?? 'http://localhost:4000';

  async enqueue(
    tenantId: string,
    actorId: string,
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const res = await fetch(`${this.base}/api/webhooks/outbox`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-id': tenantId, 'x-user-id': actorId },
      body: JSON.stringify({ aggregateType, aggregateId, eventType, payload }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new InternalServerErrorException(`outbox enqueue failed (${res.status}): ${text}`);
    }
  }
}
