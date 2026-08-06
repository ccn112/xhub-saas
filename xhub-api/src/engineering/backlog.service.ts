import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const TYPES = [
  'FEATURE',
  'STORY',
  'TASK',
  'DEFECT',
  'SECURITY_FINDING',
  'TECH_DEBT',
  'DOCUMENTATION',
  'TEST_GAP',
  'UPGRADE_MIGRATION',
  'COMPLIANCE_ACTION',
];

const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];

const STATUSES = [
  'IDEA', 'TRIAGED', 'READY', 'IN_PROGRESS', 'IN_REVIEW', 'READY_FOR_TEST', 'TESTING',
  'ACCEPTED', 'RELEASED', 'BLOCKED', 'REJECTED', 'DUPLICATE', 'DEFERRED', 'CANCELLED',
];

// BacklogItem FSM (data/STATE_MACHINES.csv, BacklogItem rows in the source
// handoff). Terminal: RELEASED/REJECTED/DUPLICATE/CANCELLED. BLOCKED/DEFERRED
// are side-branches reachable from most active states and return to an
// active state, not forward progress.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  IDEA: ['TRIAGED', 'CANCELLED'],
  TRIAGED: ['READY', 'REJECTED', 'DUPLICATE', 'CANCELLED'],
  READY: ['IN_PROGRESS', 'BLOCKED', 'DEFERRED', 'CANCELLED'],
  IN_PROGRESS: ['IN_REVIEW', 'BLOCKED', 'CANCELLED'],
  IN_REVIEW: ['READY_FOR_TEST', 'IN_PROGRESS', 'CANCELLED'],
  READY_FOR_TEST: ['TESTING', 'CANCELLED'],
  TESTING: ['ACCEPTED', 'IN_PROGRESS', 'CANCELLED'],
  ACCEPTED: ['RELEASED'],
  RELEASED: [],
  BLOCKED: ['READY', 'IN_PROGRESS'],
  DEFERRED: ['READY'],
  REJECTED: [],
  DUPLICATE: [],
  CANCELLED: [],
};

export interface CreateBacklogItemInput {
  productId: string;
  featureId?: string;
  code?: string;
  title: string;
  description?: string;
  type?: string;
  priority?: string;
  targetVersionId?: string;
  actorId?: string;
  // Provenance (reserved columns, wired up 2026-08-06 for the Product
  // Customer Support escalate action — first real writer of these fields).
  sourceSystem?: string;
  sourceRef?: string;
  correlationId?: string;
}

/**
 * BacklogItem registry + FSM guard (DG-02). Platform-wide, withBypass only —
 * same pattern as VersionsService.
 */
@Injectable()
export class BacklogService {
  constructor(private readonly prisma: PrismaService) {}

  list(productId: string, filters: { status?: string; targetVersionId?: string } = {}) {
    return this.prisma.withBypass(() =>
      this.prisma.db.backlogItem.findMany({
        where: {
          productId,
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.targetVersionId ? { targetVersionId: filters.targetVersionId } : {}),
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      }),
    );
  }

  async get(idOrCode: string) {
    const item = await this.prisma.withBypass(() =>
      this.prisma.db.backlogItem.findFirst({ where: { OR: [{ id: idOrCode }, { code: idOrCode }] } }),
    );
    if (!item) throw new NotFoundException(`Unknown backlog item: ${idOrCode}`);
    return item;
  }

  async create(input: CreateBacklogItemInput) {
    if (!input.title?.trim()) throw new BadRequestException('title is required');
    const type = input.type ?? 'TASK';
    if (!TYPES.includes(type)) throw new BadRequestException(`type must be one of ${TYPES.join(', ')}`);
    const priority = input.priority ?? 'P2';
    if (!PRIORITIES.includes(priority)) throw new BadRequestException(`priority must be one of ${PRIORITIES.join(', ')}`);
    const product = await this.prisma.withBypass(() =>
      this.prisma.db.product.findUnique({ where: { id: input.productId } }),
    );
    if (!product) throw new NotFoundException(`Unknown product: ${input.productId}`);

    const code = input.code?.trim() || (await this.nextCode(product.code));
    const existing = await this.prisma.withBypass(() =>
      this.prisma.db.backlogItem.findUnique({ where: { code } }),
    );
    if (existing) throw new BadRequestException(`Backlog item code already exists: ${code}`);
    return this.prisma.withBypass(() =>
      this.prisma.db.backlogItem.create({
        data: {
          productId: input.productId,
          featureId: input.featureId,
          code,
          title: input.title,
          description: input.description,
          type,
          priority,
          targetVersionId: input.targetVersionId,
          ...(input.sourceSystem ? { sourceSystem: input.sourceSystem } : {}),
          ...(input.sourceRef ? { sourceRef: input.sourceRef } : {}),
          ...(input.correlationId ? { correlationId: input.correlationId } : {}),
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
      }),
    );
  }

  /** Auto-generated code when the caller doesn't supply one — same idiom as DefectsService.nextCode(). */
  private async nextCode(productCode: string): Promise<string> {
    const count = await this.prisma.withBypass(() =>
      this.prisma.db.backlogItem.count({ where: { code: { startsWith: `BLG-${productCode}-` } } }),
    );
    return `BLG-${productCode}-${String(count + 1).padStart(4, '0')}`;
  }

  /** FSM transition — same guard style as VersionsService.transition(). */
  async transition(id: string, toStatus: string, actorId: string) {
    const item = await this.prisma.withBypass(() => this.prisma.db.backlogItem.findUnique({ where: { id } }));
    if (!item) throw new NotFoundException(`Unknown backlog item: ${id}`);
    if (!STATUSES.includes(toStatus)) throw new BadRequestException(`Unknown status: ${toStatus}`);
    const allowed = ALLOWED_TRANSITIONS[item.status] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new BadRequestException(
        `Cannot transition ${item.status} → ${toStatus} (allowed: ${allowed.join(', ') || 'none'})`,
      );
    }
    return this.prisma.withBypass(() =>
      this.prisma.db.backlogItem.update({ where: { id }, data: { status: toStatus, updatedBy: actorId } }),
    );
  }
}
