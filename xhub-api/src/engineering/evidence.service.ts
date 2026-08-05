import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const LEVELS = [
  'E1_DECLARED', 'E2_DOCUMENTED', 'E3_LINKED_ARTIFACT',
  'E4_TEST_EXECUTED', 'E5_PEER_REVIEWED', 'E6_INDEPENDENTLY_VERIFIED',
];

export interface RecordEvidenceInput {
  level?: string;
  subjectType: string;
  subjectId: string;
  description: string;
  sourceRef?: string;
  actorId?: string;
}

/**
 * Evidence ledger (DG-12-lite). Platform-wide, withBypass only. Append-only
 * (like TestResult) — recording evidence never overwrites prior evidence
 * for the same subject, it accumulates. `create()` is intentionally OPEN
 * (no permission gate) — same reasoning as TestResultsController/
 * DefectsController.create(): logging a pointer to proof is a self-service
 * action, not a governance decision.
 */
@Injectable()
export class EvidenceService {
  constructor(private readonly prisma: PrismaService) {}

  listForSubject(subjectType: string, subjectId: string) {
    return this.prisma.withBypass(() =>
      this.prisma.db.evidence.findMany({
        where: { subjectType, subjectId },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async record(input: RecordEvidenceInput) {
    if (!input.subjectType?.trim()) throw new BadRequestException('subjectType is required');
    if (!input.subjectId?.trim()) throw new BadRequestException('subjectId is required');
    if (!input.description?.trim()) throw new BadRequestException('description is required');
    const level = input.level ?? 'E1_DECLARED';
    if (!LEVELS.includes(level)) throw new BadRequestException(`level must be one of ${LEVELS.join(', ')}`);
    const code = await this.nextCode();
    return this.prisma.withBypass(() =>
      this.prisma.db.evidence.create({
        data: {
          code,
          level,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          description: input.description,
          sourceRef: input.sourceRef,
          recordedBy: input.actorId,
        },
      }),
    );
  }

  private async nextCode(): Promise<string> {
    const count = await this.prisma.withBypass(() => this.prisma.db.evidence.count());
    return `EVD-${String(count + 1).padStart(4, '0')}`;
  }
}
