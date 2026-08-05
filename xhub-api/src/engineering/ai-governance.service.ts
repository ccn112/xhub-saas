import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const RISK_TIERS = ['MINIMAL', 'LIMITED', 'HIGH', 'UNACCEPTABLE'];
const SYSTEM_STATUSES = ['REGISTERED', 'ASSESSING', 'APPROVED', 'RESTRICTED', 'RETIRED'];
const ASSESSMENT_STATUSES = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_UPDATE'];

// AIImpactAssessment FSM — mirrors the "human approves, AI never
// self-approves" principle from the source handoff: reaching APPROVED
// always requires a gated transition call by a real actor with
// engineering.ai-governance.manage.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['IN_REVIEW'],
  IN_REVIEW: ['APPROVED', 'REJECTED', 'NEEDS_UPDATE'],
  NEEDS_UPDATE: ['DRAFT'],
  REJECTED: ['DRAFT'],
  APPROVED: ['NEEDS_UPDATE'],
};

export interface CreateAISystemInput {
  code: string;
  productId: string;
  name: string;
  purpose?: string;
  provider?: string;
  riskTier?: string;
  humanOversight?: string;
  standardsRefs?: string[];
  actorId?: string;
}

/**
 * AI System Registry + Impact Assessment (DG-10). Platform-wide, withBypass
 * only. Registry only — no evaluation-run/model-card tracking yet (future
 * extension, not part of this pass).
 */
@Injectable()
export class AiGovernanceService {
  constructor(private readonly prisma: PrismaService) {}

  listSystems(productId?: string) {
    return this.prisma.withBypass(() =>
      this.prisma.db.aISystem.findMany({
        where: productId ? { productId } : undefined,
        include: { impactAssessments: { orderBy: { createdAt: 'desc' }, take: 1 } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async getSystem(idOrCode: string) {
    const system = await this.prisma.withBypass(() =>
      this.prisma.db.aISystem.findFirst({
        where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
        include: { impactAssessments: { orderBy: { createdAt: 'desc' } } },
      }),
    );
    if (!system) throw new NotFoundException(`Unknown AI system: ${idOrCode}`);
    return system;
  }

  async createSystem(input: CreateAISystemInput) {
    if (!input.code?.trim()) throw new BadRequestException('code is required');
    if (!input.name?.trim()) throw new BadRequestException('name is required');
    const riskTier = input.riskTier ?? 'MINIMAL';
    if (!RISK_TIERS.includes(riskTier)) throw new BadRequestException(`riskTier must be one of ${RISK_TIERS.join(', ')}`);
    const product = await this.prisma.withBypass(() =>
      this.prisma.db.product.findUnique({ where: { id: input.productId } }),
    );
    if (!product) throw new NotFoundException(`Unknown product: ${input.productId}`);
    const existing = await this.prisma.withBypass(() =>
      this.prisma.db.aISystem.findUnique({ where: { code: input.code } }),
    );
    if (existing) throw new BadRequestException(`AI system code already exists: ${input.code}`);
    return this.prisma.withBypass(() =>
      this.prisma.db.aISystem.create({
        data: {
          code: input.code,
          productId: input.productId,
          name: input.name,
          purpose: input.purpose,
          provider: input.provider,
          riskTier,
          humanOversight: input.humanOversight,
          standardsRefs: input.standardsRefs ?? [],
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
      }),
    );
  }

  async setSystemStatus(id: string, status: string, actorId: string) {
    if (!SYSTEM_STATUSES.includes(status)) {
      throw new BadRequestException(`status must be one of ${SYSTEM_STATUSES.join(', ')}`);
    }
    const system = await this.prisma.withBypass(() => this.prisma.db.aISystem.findUnique({ where: { id } }));
    if (!system) throw new NotFoundException(`Unknown AI system: ${id}`);
    return this.prisma.withBypass(() =>
      this.prisma.db.aISystem.update({ where: { id }, data: { status, updatedBy: actorId } }),
    );
  }

  async createAssessment(aiSystemId: string, actorId?: string) {
    const system = await this.prisma.withBypass(() => this.prisma.db.aISystem.findUnique({ where: { id: aiSystemId } }));
    if (!system) throw new NotFoundException(`Unknown AI system: ${aiSystemId}`);
    return this.prisma.withBypass(() =>
      this.prisma.db.aIImpactAssessment.create({
        data: { aiSystemId, createdBy: actorId, updatedBy: actorId },
      }),
    );
  }

  /** FSM transition — approval requires a real actor (see class docblock). */
  async transitionAssessment(
    id: string,
    toStatus: string,
    actorId: string,
    fields: { risksIdentified?: string; mitigations?: string; approverRole?: string } = {},
  ) {
    const assessment = await this.prisma.withBypass(() => this.prisma.db.aIImpactAssessment.findUnique({ where: { id } }));
    if (!assessment) throw new NotFoundException(`Unknown AI impact assessment: ${id}`);
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
      throw new BadRequestException('approverRole is required to approve an AI impact assessment');
    }
    return this.prisma.withBypass(() =>
      this.prisma.db.aIImpactAssessment.update({
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
