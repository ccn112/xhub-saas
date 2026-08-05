import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateFeatureInput {
  productId: string;
  code: string;
  title: string;
  description?: string;
  targetVersionId?: string;
  standardsRefs?: string[];
  actorId?: string;
}

const VALID_STATUSES = ['PROPOSED', 'PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELLED'];

/**
 * Feature registry (DG-02, docs/implementation/engineering-hub). Platform-
 * wide, withBypass only — same pattern as ProductsService. A Feature groups
 * BacklogItems; the FSM/status tracking that matters lives on the items
 * (BacklogService), this is just a lightweight grouping label + target
 * version.
 */
@Injectable()
export class FeaturesService {
  constructor(private readonly prisma: PrismaService) {}

  listForProduct(productId: string) {
    return this.prisma.withBypass(() =>
      this.prisma.db.feature.findMany({
        where: { productId },
        orderBy: { createdAt: 'desc' },
        include: { backlogItems: true },
      }),
    );
  }

  async get(idOrCode: string) {
    const feature = await this.prisma.withBypass(() =>
      this.prisma.db.feature.findFirst({
        where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
        include: { backlogItems: true },
      }),
    );
    if (!feature) throw new NotFoundException(`Unknown feature: ${idOrCode}`);
    return feature;
  }

  async create(input: CreateFeatureInput) {
    if (!input.code?.trim()) throw new BadRequestException('code is required');
    if (!input.title?.trim()) throw new BadRequestException('title is required');
    const product = await this.prisma.withBypass(() =>
      this.prisma.db.product.findUnique({ where: { id: input.productId } }),
    );
    if (!product) throw new NotFoundException(`Unknown product: ${input.productId}`);
    const existing = await this.prisma.withBypass(() =>
      this.prisma.db.feature.findUnique({ where: { code: input.code } }),
    );
    if (existing) throw new BadRequestException(`Feature code already exists: ${input.code}`);
    return this.prisma.withBypass(() =>
      this.prisma.db.feature.create({
        data: {
          productId: input.productId,
          code: input.code,
          title: input.title,
          description: input.description,
          targetVersionId: input.targetVersionId,
          standardsRefs: input.standardsRefs ?? [],
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
      }),
    );
  }

  async setStatus(id: string, status: string, actorId: string) {
    if (!VALID_STATUSES.includes(status)) {
      throw new BadRequestException(`status must be one of ${VALID_STATUSES.join(', ')}`);
    }
    const feature = await this.prisma.withBypass(() => this.prisma.db.feature.findUnique({ where: { id } }));
    if (!feature) throw new NotFoundException(`Unknown feature: ${id}`);
    return this.prisma.withBypass(() =>
      this.prisma.db.feature.update({ where: { id }, data: { status, updatedBy: actorId } }),
    );
  }
}
