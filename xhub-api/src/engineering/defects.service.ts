import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SEVERITIES = ['P0', 'P1', 'P2', 'P3'];

const STATUSES = [
  'NEW', 'TRIAGED', 'IN_PROGRESS', 'FIX_READY', 'VERIFYING', 'CLOSED',
  'WONT_FIX', 'DUPLICATE', 'REOPENED',
];

// Defect FSM (DG-05, data/STATE_MACHINES.csv Defect rows). Terminal only in
// the sense of "no further forward progress expected"; REOPENED is always
// reachable from any resolved state so a regression never needs a new row.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  NEW: ['TRIAGED', 'WONT_FIX'],
  TRIAGED: ['IN_PROGRESS', 'WONT_FIX', 'DUPLICATE'],
  IN_PROGRESS: ['FIX_READY', 'TRIAGED'],
  FIX_READY: ['VERIFYING', 'IN_PROGRESS'],
  VERIFYING: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  WONT_FIX: ['REOPENED'],
  DUPLICATE: ['REOPENED'],
  REOPENED: ['TRIAGED'],
};

export interface CreateDefectInput {
  productId: string;
  productVersionId?: string;
  testCaseId?: string;
  testResultId?: string;
  backlogItemId?: string;
  title: string;
  description?: string;
  severity?: string;
  standardsRefs?: string[];
  code?: string;
  actorId?: string;
}

/**
 * Defect registry + FSM guard (DG-05). Platform-wide, withBypass only — same
 * pattern as BacklogService. `create()` is idempotent on `testResultId`
 * (unique in schema): filing a defect twice from the same FAIL result
 * returns the existing row instead of erroring, since the primary trigger is
 * a UI button next to a FAIL result that a tester could click more than
 * once. Closing a P0/P1 defect without `rootCause` is rejected — matches
 * the source handoff's "RCA mandatory for P0/P1" rule.
 */
@Injectable()
export class DefectsService {
  constructor(private readonly prisma: PrismaService) {}

  list(productId: string, filters: { status?: string; severity?: string } = {}) {
    return this.prisma.withBypass(() =>
      this.prisma.db.defect.findMany({
        where: {
          productId,
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.severity ? { severity: filters.severity } : {}),
        },
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
      }),
    );
  }

  async get(idOrCode: string) {
    const defect = await this.prisma.withBypass(() =>
      this.prisma.db.defect.findFirst({ where: { OR: [{ id: idOrCode }, { code: idOrCode }] } }),
    );
    if (!defect) throw new NotFoundException(`Unknown defect: ${idOrCode}`);
    return defect;
  }

  async create(input: CreateDefectInput) {
    if (!input.title?.trim()) throw new BadRequestException('title is required');
    const severity = input.severity ?? 'P2';
    if (!SEVERITIES.includes(severity)) {
      throw new BadRequestException(`severity must be one of ${SEVERITIES.join(', ')}`);
    }
    const product = await this.prisma.withBypass(() =>
      this.prisma.db.product.findUnique({ where: { id: input.productId } }),
    );
    if (!product) throw new NotFoundException(`Unknown product: ${input.productId}`);

    // Idempotent on testResultId: repeat "báo lỗi" clicks on the same FAIL
    // result return the existing defect rather than throwing.
    if (input.testResultId) {
      const existing = await this.prisma.withBypass(() =>
        this.prisma.db.defect.findUnique({ where: { testResultId: input.testResultId } }),
      );
      if (existing) return existing;
      const result = await this.prisma.withBypass(() =>
        this.prisma.db.testResult.findUnique({ where: { id: input.testResultId } }),
      );
      if (!result) throw new NotFoundException(`Unknown test result: ${input.testResultId}`);
    }

    const code = input.code?.trim() || (await this.nextCode(product.code));
    const clash = await this.prisma.withBypass(() => this.prisma.db.defect.findUnique({ where: { code } }));
    if (clash) throw new BadRequestException(`Defect code already exists: ${code}`);

    return this.prisma.withBypass(() =>
      this.prisma.db.defect.create({
        data: {
          productId: input.productId,
          productVersionId: input.productVersionId,
          testCaseId: input.testCaseId,
          testResultId: input.testResultId,
          backlogItemId: input.backlogItemId,
          code,
          title: input.title,
          description: input.description,
          severity,
          standardsRefs: input.standardsRefs ?? [],
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
      }),
    );
  }

  private async nextCode(productCode: string): Promise<string> {
    const count = await this.prisma.withBypass(() =>
      this.prisma.db.defect.count({ where: { code: { startsWith: `DEF-${productCode}-` } } }),
    );
    return `DEF-${productCode}-${String(count + 1).padStart(4, '0')}`;
  }

  /** FSM transition — same guard style as BacklogService.transition(). */
  async transition(id: string, toStatus: string, actorId: string, rootCause?: string) {
    const defect = await this.prisma.withBypass(() => this.prisma.db.defect.findUnique({ where: { id } }));
    if (!defect) throw new NotFoundException(`Unknown defect: ${id}`);
    if (!STATUSES.includes(toStatus)) throw new BadRequestException(`Unknown status: ${toStatus}`);
    const allowed = ALLOWED_TRANSITIONS[defect.status] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new BadRequestException(
        `Cannot transition ${defect.status} → ${toStatus} (allowed: ${allowed.join(', ') || 'none'})`,
      );
    }
    const effectiveRootCause = rootCause?.trim() || defect.rootCause?.trim() || undefined;
    if (toStatus === 'CLOSED' && (defect.severity === 'P0' || defect.severity === 'P1') && !effectiveRootCause) {
      throw new BadRequestException('rootCause is required before closing a P0/P1 defect');
    }
    return this.prisma.withBypass(() =>
      this.prisma.db.defect.update({
        where: { id },
        data: {
          status: toStatus,
          updatedBy: actorId,
          ...(rootCause?.trim() ? { rootCause: rootCause.trim() } : {}),
        },
      }),
    );
  }
}
