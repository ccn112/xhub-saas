import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const STATUSES = ['NOT_RUN', 'PASS', 'FAIL', 'BLOCKED', 'NOT_APPLICABLE', 'NEEDS_CLARIFICATION'];

export interface RecordResultInput {
  testCaseId: string;
  productVersionId?: string;
  status: string;
  actualResult?: string;
  notes?: string;
  environment?: string;
  testerUserId?: string;
}

/**
 * TestResult recorder (DG-04-lite). Append-only by design — recording a
 * result NEVER updates a prior row, it always inserts a new one, so full
 * history is preserved (matches the source handoff's "test result không sửa
 * lịch sử" invariant, and the existing /docs/test checklist's own open-to-
 * any-tester posture — no permission gate here, same as today).
 */
@Injectable()
export class TestResultsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordResultInput) {
    if (!STATUSES.includes(input.status)) {
      throw new BadRequestException(`status must be one of ${STATUSES.join(', ')}`);
    }
    const testCase = await this.prisma.withBypass(() =>
      this.prisma.db.testCase.findUnique({ where: { id: input.testCaseId } }),
    );
    if (!testCase) throw new NotFoundException(`Unknown test case: ${input.testCaseId}`);
    return this.prisma.withBypass(() =>
      this.prisma.db.testResult.create({
        data: {
          testCaseId: input.testCaseId,
          productVersionId: input.productVersionId,
          status: input.status,
          actualResult: input.actualResult,
          notes: input.notes,
          environment: input.environment,
          testerUserId: input.testerUserId,
        },
      }),
    );
  }

  history(testCaseId: string) {
    return this.prisma.withBypass(() =>
      this.prisma.db.testResult.findMany({ where: { testCaseId }, orderBy: { testedAt: 'desc' } }),
    );
  }
}
