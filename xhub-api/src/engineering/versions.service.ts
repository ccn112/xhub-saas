import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const STATUSES = [
  'DRAFT',
  'PLANNING',
  'IN_DEVELOPMENT',
  'CODE_FREEZE',
  'UAT',
  'RELEASE_CANDIDATE',
  'RELEASED',
  'DEPRECATED',
  'END_OF_LIFE',
];

// ProductVersion FSM (data/STATE_MACHINES.csv in the source handoff). RELEASED
// is immutable content-wise (docs/05_VERSION_BACKLOG_RELEASE.md) but the
// lifecycle still continues forward into DEPRECATED/END_OF_LIFE. CODE_FREEZE
// and UAT/RELEASE_CANDIDATE allow one step back (freeze breaks, RC fails UAT)
// — every other transition is forward-only.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PLANNING'],
  PLANNING: ['IN_DEVELOPMENT'],
  IN_DEVELOPMENT: ['CODE_FREEZE'],
  CODE_FREEZE: ['UAT', 'IN_DEVELOPMENT'],
  UAT: ['RELEASE_CANDIDATE', 'IN_DEVELOPMENT'],
  RELEASE_CANDIDATE: ['RELEASED', 'UAT'],
  RELEASED: ['DEPRECATED'],
  DEPRECATED: ['END_OF_LIFE'],
  END_OF_LIFE: [],
};

export interface CreateVersionInput {
  version: string;
  releaseTrainId?: string;
  releaseChannel?: string;
  actorId?: string;
}

/**
 * ProductVersion registry + FSM guard (DG-01). Platform-wide, withBypass only
 * — see products.service.ts docblock for the same rationale.
 */
@Injectable()
export class VersionsService {
  constructor(private readonly prisma: PrismaService) {}

  listForProduct(productId: string) {
    return this.prisma.withBypass(() =>
      this.prisma.db.productVersion.findMany({
        where: { productId },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async create(productId: string, input: CreateVersionInput) {
    if (!input.version?.trim()) throw new BadRequestException('version is required');
    const product = await this.prisma.withBypass(() =>
      this.prisma.db.product.findUnique({ where: { id: productId } }),
    );
    if (!product) throw new NotFoundException(`Unknown product: ${productId}`);
    const existing = await this.prisma.withBypass(() =>
      this.prisma.db.productVersion.findUnique({
        where: { productId_version: { productId, version: input.version } },
      }),
    );
    if (existing) throw new BadRequestException(`Version already exists: ${input.version}`);
    return this.prisma.withBypass(() =>
      this.prisma.db.productVersion.create({
        data: {
          productId,
          version: input.version,
          releaseTrainId: input.releaseTrainId,
          releaseChannel: input.releaseChannel,
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
      }),
    );
  }

  /**
   * FSM transition. Only the moves listed in ALLOWED_TRANSITIONS succeed —
   * everything else (including any jump straight to RELEASED, or any move
   * out of END_OF_LIFE) is rejected with the allowed set named in the error,
   * matching every other FSM guard in this codebase (Request/Ticket/
   * Booking/Directive).
   */
  async transition(versionId: string, toStatus: string, actorId: string) {
    const version = await this.prisma.withBypass(() =>
      this.prisma.db.productVersion.findUnique({ where: { id: versionId } }),
    );
    if (!version) throw new NotFoundException(`Unknown version: ${versionId}`);
    if (!STATUSES.includes(toStatus)) {
      throw new BadRequestException(`Unknown status: ${toStatus}`);
    }
    const allowed = ALLOWED_TRANSITIONS[version.status] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new BadRequestException(
        `Cannot transition ${version.status} → ${toStatus} (allowed: ${allowed.join(', ') || 'none'})`,
      );
    }
    return this.prisma.withBypass(() =>
      this.prisma.db.productVersion.update({
        where: { id: versionId },
        data: {
          status: toStatus,
          releasedAt: toStatus === 'RELEASED' ? new Date() : version.releasedAt,
          updatedBy: actorId,
        },
      }),
    );
  }
}
