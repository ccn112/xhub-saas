import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';
import { DECISION_STATUSES } from './manage.constants';

/**
 * DecisionRecord (X.Office Management — MG-01). A RAPID decision: who recommends /
 * agrees / performs / provides input / decides, plus rationale + evidence. DISTINCT
 * from a Directive (#3): a Directive is an operational order with an SLA; a
 * DecisionRecord captures decision RIGHTS + reasoning + evidence, and may SPAWN a
 * Directive or an ActionCommitment (linked, never merged).
 */
@Injectable()
export class DecisionsService {
  constructor(private readonly prisma: XofficePrismaService) {}
  private get db() {
    return this.prisma.db;
  }

  async list(tenantId: string, filter: { status?: string; reviewId?: string } = {}) {
    const items = await this.db.decisionRecord.findMany({
      where: {
        tenantId,
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.reviewId ? { reviewId: filter.reviewId } : {}),
      },
      orderBy: [{ decidedAt: 'desc' }],
    });
    // Aging (days since decided) surfaced for the decision center backlog view.
    const now = Date.now();
    const withAging = items.map((d) => ({
      ...d,
      ageDays: Math.max(0, Math.round((now - new Date(d.decidedAt).getTime()) / 86_400_000)),
    }));
    return { items: withAging, count: withAging.length };
  }

  async get(tenantId: string, id: string) {
    const d = await this.db.decisionRecord.findFirst({ where: { id, tenantId } });
    if (!d) throw new NotFoundException(`decision not found: ${id}`);
    const actions = await this.db.actionCommitment.findMany({ where: { tenantId, decisionId: id } });
    return { ...d, actions };
  }

  async create(tenantId: string, actorId: string, body: any) {
    if (!body?.question) throw new BadRequestException('question is required');
    if (!body?.decision) throw new BadRequestException('decision is required');
    const status = (body.status ?? 'PROPOSED').toUpperCase();
    if (!DECISION_STATUSES.includes(status)) throw new BadRequestException(`invalid status ${status}`);
    const d = await this.db.decisionRecord.create({
      data: {
        tenantId,
        reviewId: body.reviewId ?? null,
        question: body.question,
        context: body.context ?? null,
        deciderId: body.deciderId ?? actorId,
        recommenderId: body.recommenderId ?? null,
        decision: body.decision,
        rationale: body.rationale ?? null,
        decidedAt: body.decidedAt ? new Date(body.decidedAt) : new Date(),
        reviewAt: body.reviewAt ? new Date(body.reviewAt) : null,
        status,
        rapid: body.rapid ?? {},
        options: body.options ?? undefined,
        evidenceRefs: body.evidenceRefs ?? [],
        createdBy: actorId,
      },
    });
    // Wire into the originating review's decisionIds (loop connectivity).
    if (body.reviewId) {
      const review = await this.db.businessReview.findFirst({ where: { id: body.reviewId, tenantId } });
      if (review && !review.decisionIds.includes(d.id)) {
        await this.db.businessReview.update({
          where: { id: review.id },
          data: { decisionIds: { set: [...review.decisionIds, d.id] } },
        });
      }
    }
    await this.db.auditLog.create({
      data: { tenantId, instanceCode: d.id, actorId, action: 'manage.decision.create', detail: body.question.slice(0, 400), at: new Date() },
    });
    return d;
  }

  async update(tenantId: string, actorId: string, id: string, body: any) {
    const existing = await this.db.decisionRecord.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException(`decision not found: ${id}`);
    if (body.status) {
      const status = String(body.status).toUpperCase();
      if (!DECISION_STATUSES.includes(status as any)) throw new BadRequestException(`invalid status ${status}`);
      body.status = status;
    }
    const d = await this.db.decisionRecord.update({
      where: { id },
      data: {
        decision: body.decision ?? undefined,
        rationale: body.rationale ?? undefined,
        status: body.status ?? undefined,
        reviewAt: body.reviewAt ? new Date(body.reviewAt) : undefined,
        rapid: body.rapid ?? undefined,
        options: body.options ?? undefined,
        evidenceRefs: body.evidenceRefs ?? undefined,
      },
    });
    return d;
  }
}
