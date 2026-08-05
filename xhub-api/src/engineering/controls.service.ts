import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const IMPL_STATUSES = ['PROPOSED', 'IN_PLACE', 'PARTIAL', 'NOT_APPLICABLE', 'RETIRED'];

export interface CreateControlInput {
  code: string;
  domain: string;
  title: string;
  description?: string;
  frameworkFamilies?: string[];
}

export interface SetImplementationInput {
  controlId: string;
  productId: string;
  status: string;
  evidenceRefs?: string[];
  notes?: string;
  actorId?: string;
}

/**
 * Unified Control Framework catalog + per-Product implementation status
 * (DG-09). Platform-wide, withBypass only — same pattern as
 * ProductsService. `Control` is a shared catalog (create/edit gated);
 * `ControlImplementation` is upserted per (control, product) pair — same
 * "set current state" shape as CiService.recordBuild, not append-only.
 */
@Injectable()
export class ControlsService {
  constructor(private readonly prisma: PrismaService) {}

  listControls(domain?: string) {
    return this.prisma.withBypass(() =>
      this.prisma.db.control.findMany({
        where: domain ? { domain } : undefined,
        orderBy: [{ domain: 'asc' }, { code: 'asc' }],
      }),
    );
  }

  async createControl(input: CreateControlInput) {
    if (!input.code?.trim()) throw new BadRequestException('code is required');
    if (!input.domain?.trim()) throw new BadRequestException('domain is required');
    if (!input.title?.trim()) throw new BadRequestException('title is required');
    const existing = await this.prisma.withBypass(() =>
      this.prisma.db.control.findUnique({ where: { code: input.code } }),
    );
    if (existing) throw new BadRequestException(`Control code already exists: ${input.code}`);
    return this.prisma.withBypass(() =>
      this.prisma.db.control.create({
        data: {
          code: input.code,
          domain: input.domain,
          title: input.title,
          description: input.description,
          frameworkFamilies: input.frameworkFamilies ?? [],
        },
      }),
    );
  }

  /** Implementation status for a Product, joined with the control catalog. */
  listImplementations(productId: string) {
    return this.prisma.withBypass(() =>
      this.prisma.db.controlImplementation.findMany({
        where: { productId },
        include: { control: true },
        orderBy: { control: { domain: 'asc' } },
      }),
    );
  }

  async setImplementation(input: SetImplementationInput) {
    if (!IMPL_STATUSES.includes(input.status)) {
      throw new BadRequestException(`status must be one of ${IMPL_STATUSES.join(', ')}`);
    }
    const [control, product] = await Promise.all([
      this.prisma.withBypass(() => this.prisma.db.control.findUnique({ where: { id: input.controlId } })),
      this.prisma.withBypass(() => this.prisma.db.product.findUnique({ where: { id: input.productId } })),
    ]);
    if (!control) throw new NotFoundException(`Unknown control: ${input.controlId}`);
    if (!product) throw new NotFoundException(`Unknown product: ${input.productId}`);
    return this.prisma.withBypass(() =>
      this.prisma.db.controlImplementation.upsert({
        where: { controlId_productId: { controlId: input.controlId, productId: input.productId } },
        create: {
          controlId: input.controlId,
          productId: input.productId,
          status: input.status,
          evidenceRefs: input.evidenceRefs ?? [],
          notes: input.notes,
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
        update: {
          status: input.status,
          evidenceRefs: input.evidenceRefs ?? [],
          notes: input.notes,
          updatedBy: input.actorId,
        },
        include: { control: true },
      }),
    );
  }
}
