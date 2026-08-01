import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ACTION_STATUSES } from './manage.constants';

/**
 * ActionCommitment (X.Office Management — MG-01) — the BRIDGE (#13). A commitment
 * from a decision/review becomes REAL work by LINKING to a NativeWorkItem. We do
 * NOT create a 3rd task table and we do NOT duplicate progress — the linked Work
 * item is the SoR for execution state; here we only read it back for the loop.
 * When `spawnWorkItem` is set, a NativeWorkItem of type FOLLOW_UP is created and
 * linked; otherwise an existing `nativeWorkItemId` is linked.
 */
@Injectable()
export class ActionsService {
  constructor(private readonly prisma: PrismaService) {}
  private get db() {
    return this.prisma.db;
  }

  /** Create an action; optionally spawn a linked FOLLOW_UP NativeWorkItem (the bridge). */
  async create(tenantId: string, actorId: string, body: any) {
    if (!body?.title) throw new BadRequestException('title is required');
    const status = (body.status ?? 'OPEN').toUpperCase();
    if (!ACTION_STATUSES.includes(status)) throw new BadRequestException(`invalid status ${status}`);

    let nativeWorkItemId: string | null = body.nativeWorkItemId ?? null;

    // Bridge: spawn a real Work item (type FOLLOW_UP) and link it. Reuses the
    // existing NativeWorkItem engine — MG never rebuilds the task model (#13).
    if (body.spawnWorkItem && !nativeWorkItemId) {
      const wi = await this.db.nativeWorkItem.create({
        data: {
          tenantId,
          type: 'FOLLOW_UP',
          title: body.title,
          description: body.description ?? null,
          status: 'TODO',
          priority: body.priority ?? 'HIGH',
          ownerId: body.ownerId ?? actorId,
          assigneeIds: body.ownerId ? [body.ownerId] : [],
          dueAt: body.dueAt ? new Date(body.dueAt) : null,
          tags: ['manage', 'action-commitment'],
          sourceContext: { origin: 'manage.action', decisionId: body.decisionId ?? null, reviewId: body.reviewId ?? null },
          createdBy: actorId,
        },
      });
      nativeWorkItemId = wi.id;
    } else if (nativeWorkItemId) {
      // Validate the linked item exists in-tenant (RLS-scoped) before linking.
      const wi = await this.db.nativeWorkItem.findFirst({ where: { id: nativeWorkItemId, tenantId } });
      if (!wi) throw new BadRequestException(`nativeWorkItemId not found in tenant: ${nativeWorkItemId}`);
    }

    const action = await this.db.actionCommitment.create({
      data: {
        tenantId,
        title: body.title,
        ownerId: body.ownerId ?? actorId,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        status,
        decisionId: body.decisionId ?? null,
        reviewId: body.reviewId ?? null,
        nativeWorkItemId,
        createdBy: actorId,
      },
    });

    // Wire the action into its review's actionIds (the loop is CONNECTED).
    if (body.reviewId) {
      const review = await this.db.businessReview.findFirst({ where: { id: body.reviewId, tenantId } });
      if (review && !review.actionIds.includes(action.id)) {
        await this.db.businessReview.update({
          where: { id: review.id },
          data: { actionIds: { set: [...review.actionIds, action.id] } },
        });
      }
    }
    return this.hydrate(tenantId, action);
  }

  async list(tenantId: string, filter: { status?: string; decisionId?: string; reviewId?: string } = {}) {
    const items = await this.db.actionCommitment.findMany({
      where: {
        tenantId,
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.decisionId ? { decisionId: filter.decisionId } : {}),
        ...(filter.reviewId ? { reviewId: filter.reviewId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
    });
    const hydrated = await Promise.all(items.map((a) => this.hydrate(tenantId, a)));
    return { items: hydrated, count: hydrated.length };
  }

  async get(tenantId: string, id: string) {
    const action = await this.db.actionCommitment.findFirst({ where: { id, tenantId } });
    if (!action) throw new NotFoundException(`action not found: ${id}`);
    return this.hydrate(tenantId, action);
  }

  /** Attach the linked Work item's live execution state (read-only — SoR is Work). */
  private async hydrate(tenantId: string, action: any) {
    if (!action.nativeWorkItemId) return { ...action, workItem: null };
    const wi = await this.db.nativeWorkItem.findFirst({
      where: { id: action.nativeWorkItemId, tenantId },
      select: { id: true, title: true, type: true, status: true, progressPercent: true, dueAt: true },
    });
    return { ...action, workItem: wi };
  }
}
