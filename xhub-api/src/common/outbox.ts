import { PrismaService } from '../prisma/prisma.service';

/**
 * Enqueue an OutboxEvent row. A plain shared function (not a service call)
 * because OutboxEvent is a transactional-outbox table by design: the writer
 * (any module, any process) and the dispatcher (`webhook/webhook.dispatcher.ts`,
 * XHUB_PLATFORM-only) are meant to be decoupled through the shared table, not
 * through an in-process/cross-process service call. Same-transaction call
 * (`prisma.db` already is, via TenantScopeInterceptor) so it commits
 * atomically with the caller's own write. See
 * docs/implementation/xoffice-ai/IMPLEMENTATION_PLAN.md Phase 1.5 Stage B.
 */
export async function enqueueOutboxEvent(
  prisma: PrismaService,
  tenantId: string,
  aggregateType: string,
  aggregateId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  return prisma.db.outboxEvent.create({
    data: {
      tenantId,
      aggregateType,
      aggregateId,
      eventType,
      payload: payload as any,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: new Date(),
    },
  });
}
