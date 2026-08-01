import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from './metrics.service';
import { ActionsService } from './actions.service';
import { REVIEW_STATUSES, REVIEW_TYPES } from './manage.constants';

/**
 * BusinessReview (X.Office Management — MG-01) — the executable "shell" of a
 * management cadence (#7). Its PRE-READ is a real metric snapshot: on create (or
 * refresh) it COMPUTES the linked metrics' observations from the certified read
 * model and stores the observation ids (immutable snapshot refs). Its close
 * transition produces a FOLLOW-UP commitment (a real linked NativeWorkItem via
 * ActionsService), closing the loop Objective→Metric→Review→Decision→Action.
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly actions: ActionsService,
  ) {}
  private get db() {
    return this.prisma.db;
  }

  async list(tenantId: string, filter: { status?: string; type?: string } = {}) {
    const items = await this.db.businessReview.findMany({
      where: {
        tenantId,
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.type ? { type: filter.type } : {}),
      },
      orderBy: [{ periodStart: 'desc' }],
    });
    return { items, count: items.length };
  }

  /** Full review with its pre-read snapshot (observations), decisions and actions resolved. */
  async get(tenantId: string, id: string) {
    const review = await this.db.businessReview.findFirst({ where: { id, tenantId } });
    if (!review) throw new NotFoundException(`review not found: ${id}`);
    const [observations, decisions, actions] = await Promise.all([
      review.metricObservationIds.length
        ? this.db.metricObservation.findMany({ where: { tenantId, id: { in: review.metricObservationIds } } })
        : Promise.resolve([]),
      review.decisionIds.length
        ? this.db.decisionRecord.findMany({ where: { tenantId, id: { in: review.decisionIds } } })
        : Promise.resolve([]),
      this.db.actionCommitment.findMany({ where: { tenantId, reviewId: id } }),
    ]);
    // Enrich each snapshot observation with its metric definition + RAG status.
    const metricIds = [...new Set(observations.map((o) => o.metricId))];
    const metrics = metricIds.length
      ? await this.db.metricDefinition.findMany({ where: { tenantId, id: { in: metricIds } } })
      : [];
    const metricById = new Map(metrics.map((m) => [m.id, m]));
    const preRead = observations.map((o) => {
      const m = metricById.get(o.metricId);
      return { ...o, metricCode: m?.code, metricName: m?.name, unit: m?.unit, rag: this.rag(m, o.value) };
    });
    const exceptions = preRead.filter((p) => p.rag === 'RED' || p.rag === 'AMBER');
    return { ...review, preRead, exceptions, decisions, actions };
  }

  /** RAG status of a value against a metric's thresholds + direction. */
  private rag(metric: any, value: number): 'GREEN' | 'AMBER' | 'RED' | 'UNKNOWN' {
    if (!metric) return 'UNKNOWN';
    const { direction, thresholdRed, thresholdAmber } = metric;
    if (thresholdRed == null || thresholdAmber == null) return 'UNKNOWN';
    if (direction === 'DOWN') {
      if (value >= thresholdRed) return 'RED';
      if (value >= thresholdAmber) return 'AMBER';
      return 'GREEN';
    }
    // UP (default): higher is better
    if (value <= thresholdRed) return 'RED';
    if (value <= thresholdAmber) return 'AMBER';
    return 'GREEN';
  }

  async create(tenantId: string, actorId: string, body: any) {
    const type = (body.type ?? 'MONTHLY_BUSINESS').toUpperCase();
    if (!REVIEW_TYPES.includes(type)) throw new BadRequestException(`invalid type ${type}`);
    const status = (body.status ?? 'PLANNING').toUpperCase();
    if (!REVIEW_STATUSES.includes(status)) throw new BadRequestException(`invalid status ${status}`);
    if (!body.periodStart || !body.periodEnd) throw new BadRequestException('periodStart and periodEnd are required');

    // Build the PRE-READ snapshot: compute each linked metric's observation from
    // the certified read model and capture the resulting observation ids.
    const metricIds: string[] = Array.isArray(body.metricIds) ? body.metricIds : [];
    const observationIds: string[] = [];
    for (const metricId of metricIds) {
      const { latest } = await this.metrics.observations(tenantId, metricId, { compute: true });
      if (latest) observationIds.push(latest.id);
    }

    const review = await this.db.businessReview.create({
      data: {
        tenantId,
        title: body.title ?? null,
        type,
        periodStart: new Date(body.periodStart),
        periodEnd: new Date(body.periodEnd),
        status: observationIds.length ? 'PRE_READ' : status,
        ownerId: body.ownerId ?? actorId,
        meetingInstanceId: body.meetingInstanceId ?? null,
        metricObservationIds: observationIds,
        decisionIds: [],
        actionIds: [],
        createdBy: actorId,
      },
    });
    return this.get(tenantId, review.id);
  }

  /**
   * Close a review → transition to CLOSED and PRODUCE a follow-up: a real linked
   * FOLLOW_UP NativeWorkItem + ActionCommitment (via the bridge). This is the
   * "Learn/Execute" seam that keeps the loop connected after the meeting.
   */
  async close(tenantId: string, actorId: string, id: string, body: any = {}) {
    const review = await this.db.businessReview.findFirst({ where: { id, tenantId } });
    if (!review) throw new NotFoundException(`review not found: ${id}`);

    const followUp = await this.actions.create(tenantId, actorId, {
      title: body.followUpTitle ?? `Theo dõi sau ${review.title ?? 'review'} (${review.type})`,
      ownerId: body.ownerId ?? review.ownerId,
      dueAt: body.dueAt ?? null,
      reviewId: review.id,
      spawnWorkItem: true,
      priority: 'HIGH',
    });

    // create() already appended the action to actionIds; re-read the review.
    const updated = await this.db.businessReview.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
    await this.db.auditLog.create({
      data: { tenantId, instanceCode: id, actorId, action: 'manage.review.close', detail: `followUp=${followUp.id}`, at: new Date() },
    });
    return { review: updated, followUp };
  }
}
