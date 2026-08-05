import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVITY_STATUSES = ['ACTIVE', 'UNDER_REVIEW', 'RETIRED'];
const ASSESSMENT_STATUSES = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_UPDATE'];

// PrivacyImpactAssessment FSM — identical shape to AIImpactAssessment
// (ai-governance.service.ts): human-gated approval only.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['IN_REVIEW'],
  IN_REVIEW: ['APPROVED', 'REJECTED', 'NEEDS_UPDATE'],
  NEEDS_UPDATE: ['DRAFT'],
  REJECTED: ['DRAFT'],
  APPROVED: ['NEEDS_UPDATE'],
};

export interface CreateProcessingActivityInput {
  code: string;
  productId: string;
  name: string;
  purpose?: string;
  dataCategories?: string[];
  legalBasis?: string;
  standardsRefs?: string[];
  actorId?: string;
}

/**
 * Processing Activity Registry + DPIA (DG-11). Platform-wide, withBypass
 * only — mirrors ai-governance.service.ts's shape (registry + human-gated
 * impact-assessment FSM), separate module since a ProcessingActivity and an
 * AISystem are conceptually distinct (data processing vs. an AI capability).
 */
@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  listActivities(productId?: string) {
    return this.prisma.withBypass(() =>
      this.prisma.db.processingActivity.findMany({
        where: productId ? { productId } : undefined,
        include: { assessments: { orderBy: { createdAt: 'desc' }, take: 1 } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async getActivity(idOrCode: string) {
    const activity = await this.prisma.withBypass(() =>
      this.prisma.db.processingActivity.findFirst({
        where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
        include: { assessments: { orderBy: { createdAt: 'desc' } } },
      }),
    );
    if (!activity) throw new NotFoundException(`Unknown processing activity: ${idOrCode}`);
    return activity;
  }

  async createActivity(input: CreateProcessingActivityInput) {
    if (!input.code?.trim()) throw new BadRequestException('code is required');
    if (!input.name?.trim()) throw new BadRequestException('name is required');
    const product = await this.prisma.withBypass(() =>
      this.prisma.db.product.findUnique({ where: { id: input.productId } }),
    );
    if (!product) throw new NotFoundException(`Unknown product: ${input.productId}`);
    const existing = await this.prisma.withBypass(() =>
      this.prisma.db.processingActivity.findUnique({ where: { code: input.code } }),
    );
    if (existing) throw new BadRequestException(`Processing activity code already exists: ${input.code}`);
    return this.prisma.withBypass(() =>
      this.prisma.db.processingActivity.create({
        data: {
          code: input.code,
          productId: input.productId,
          name: input.name,
          purpose: input.purpose,
          dataCategories: input.dataCategories ?? [],
          legalBasis: input.legalBasis,
          standardsRefs: input.standardsRefs ?? [],
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
      }),
    );
  }

  async setActivityStatus(id: string, status: string, actorId: string) {
    if (!ACTIVITY_STATUSES.includes(status)) {
      throw new BadRequestException(`status must be one of ${ACTIVITY_STATUSES.join(', ')}`);
    }
    const activity = await this.prisma.withBypass(() => this.prisma.db.processingActivity.findUnique({ where: { id } }));
    if (!activity) throw new NotFoundException(`Unknown processing activity: ${id}`);
    return this.prisma.withBypass(() =>
      this.prisma.db.processingActivity.update({ where: { id }, data: { status, updatedBy: actorId } }),
    );
  }

  async createAssessment(processingActivityId: string, actorId?: string) {
    const activity = await this.prisma.withBypass(() =>
      this.prisma.db.processingActivity.findUnique({ where: { id: processingActivityId } }),
    );
    if (!activity) throw new NotFoundException(`Unknown processing activity: ${processingActivityId}`);
    return this.prisma.withBypass(() =>
      this.prisma.db.privacyImpactAssessment.create({
        data: { processingActivityId, createdBy: actorId, updatedBy: actorId },
      }),
    );
  }

  async transitionAssessment(
    id: string,
    toStatus: string,
    actorId: string,
    fields: { risksIdentified?: string; mitigations?: string; approverRole?: string } = {},
  ) {
    const assessment = await this.prisma.withBypass(() => this.prisma.db.privacyImpactAssessment.findUnique({ where: { id } }));
    if (!assessment) throw new NotFoundException(`Unknown DPIA: ${id}`);
    if (!ASSESSMENT_STATUSES.includes(toStatus)) {
      throw new BadRequestException(`status must be one of ${ASSESSMENT_STATUSES.join(', ')}`);
    }
    const allowed = ALLOWED_TRANSITIONS[assessment.status] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new BadRequestException(
        `Cannot transition ${assessment.status} → ${toStatus} (allowed: ${allowed.join(', ') || 'none'})`,
      );
    }
    if (toStatus === 'APPROVED' && !fields.approverRole?.trim()) {
      throw new BadRequestException('approverRole is required to approve a DPIA');
    }
    return this.prisma.withBypass(() =>
      this.prisma.db.privacyImpactAssessment.update({
        where: { id },
        data: {
          status: toStatus,
          updatedBy: actorId,
          risksIdentified: fields.risksIdentified ?? assessment.risksIdentified,
          mitigations: fields.mitigations ?? assessment.mitigations,
          approverRole: fields.approverRole ?? assessment.approverRole,
          approvedAt: toStatus === 'APPROVED' ? new Date() : assessment.approvedAt,
        },
      }),
    );
  }
}
