import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const LEVELS = ['UAT', 'UNIT', 'INTEGRATION', 'E2E', 'SECURITY', 'VISUAL'];
const RESULT_STATUSES = ['NOT_RUN', 'PASS', 'FAIL', 'BLOCKED', 'NOT_APPLICABLE', 'NEEDS_CLARIFICATION'];

export interface CreateTestCaseInput {
  testSuiteId: string;
  code: string;
  title: string;
  expectedResult?: string;
  deepLinkTemplate?: string;
  level?: string;
  requiredForRelease?: boolean;
  standardsRefs?: string[];
}

/**
 * TestCase registry + current-status projection (DG-04-lite). "Current
 * status" is computed application-side (latest TestResult per case,
 * optionally scoped to one ProductVersion) rather than stored redundantly on
 * TestCase — TestResult stays the single append-only source of truth
 * (matches "test result không sửa lịch sử" from the source handoff's 8
 * invariants).
 */
@Injectable()
export class TestCasesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List cases in a suite, each annotated with `currentStatus` + `lastResult`
   * (latest TestResult, scoped to `productVersionId` if given, else latest
   * across any version). `status` filters the RETURNED list by that computed
   * status (NOT_RUN included — a case with no result yet matches status=NOT_RUN).
   */
  async listForSuite(testSuiteId: string, opts: { productVersionId?: string; status?: string } = {}) {
    const cases = await this.prisma.withBypass(() =>
      this.prisma.db.testCase.findMany({ where: { testSuiteId }, orderBy: { code: 'asc' } }),
    );
    if (cases.length === 0) return [];
    const caseIds = cases.map((c: any) => c.id);
    const results = await this.prisma.withBypass(() =>
      this.prisma.db.testResult.findMany({
        where: { testCaseId: { in: caseIds }, ...(opts.productVersionId ? { productVersionId: opts.productVersionId } : {}) },
        orderBy: { testedAt: 'desc' },
      }),
    );
    const latestByCase = new Map<string, any>();
    for (const r of results) {
      if (!latestByCase.has(r.testCaseId)) latestByCase.set(r.testCaseId, r);
    }
    // Attach the Defect (if any) already filed against each case's latest
    // result — lets the UI show "Đã báo lỗi #CODE" instead of a clickable
    // "Báo lỗi" button on a FAIL row that already has one (DG-05).
    const lastResultIds = [...latestByCase.values()].map((r) => r.id);
    const defects = lastResultIds.length
      ? await this.prisma.withBypass(() =>
          this.prisma.db.defect.findMany({
            where: { testResultId: { in: lastResultIds } },
            select: { id: true, code: true, status: true, testResultId: true },
          }),
        )
      : [];
    const defectByResultId = new Map(defects.map((d: any) => [d.testResultId, d]));
    const annotated = cases.map((c: any) => {
      const lastResult = latestByCase.get(c.id) ?? null;
      return {
        ...c,
        currentStatus: lastResult?.status ?? 'NOT_RUN',
        lastResult,
        defect: lastResult ? (defectByResultId.get(lastResult.id) ?? null) : null,
      };
    });
    if (opts.status) {
      if (!RESULT_STATUSES.includes(opts.status)) {
        throw new BadRequestException(`status must be one of ${RESULT_STATUSES.join(', ')}`);
      }
      return annotated.filter((c) => c.currentStatus === opts.status);
    }
    return annotated;
  }

  async create(input: CreateTestCaseInput) {
    if (!input.code?.trim()) throw new BadRequestException('code is required');
    if (!input.title?.trim()) throw new BadRequestException('title is required');
    const level = input.level ?? 'UAT';
    if (!LEVELS.includes(level)) throw new BadRequestException(`level must be one of ${LEVELS.join(', ')}`);
    const suite = await this.prisma.withBypass(() =>
      this.prisma.db.testSuite.findUnique({ where: { id: input.testSuiteId } }),
    );
    if (!suite) throw new NotFoundException(`Unknown test suite: ${input.testSuiteId}`);
    const existing = await this.prisma.withBypass(() =>
      this.prisma.db.testCase.findUnique({ where: { code: input.code } }),
    );
    if (existing) throw new BadRequestException(`Test case code already exists: ${input.code}`);
    return this.prisma.withBypass(() =>
      this.prisma.db.testCase.create({
        data: {
          testSuiteId: input.testSuiteId,
          code: input.code,
          title: input.title,
          expectedResult: input.expectedResult,
          deepLinkTemplate: input.deepLinkTemplate,
          level,
          requiredForRelease: input.requiredForRelease ?? false,
          standardsRefs: input.standardsRefs ?? [],
        },
      }),
    );
  }
}
