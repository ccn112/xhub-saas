import { BadRequestException, Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { TestRunsService } from './testruns.service';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';

interface PutTestRunDto {
  results?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

interface PostEvidenceDto {
  testCaseId?: string;
  contentBase64?: string;
  mimeType?: string;
}

/**
 * TestRuns API — server-side persistence for the QA user-test checklist
 * (/docs/test). LIGHT: JSON file per tenant+user (no Prisma table, so the fixed
 * RLS table set is untouched). Tenant isolation is by file path derived from
 * @Identity().tenantId — no DB, so no RLS interceptor is required here.
 */
@Controller('api/testruns')
export class TestRunsController {
  constructor(private readonly testRuns: TestRunsService) {}

  /** GET /api/testruns — saved blob for the current tenant+user. */
  @Get()
  get(@Identity() id: RequestIdentity) {
    return this.testRuns.get(id.tenantId, id.userId);
  }

  /** GET /api/testruns/all — tenant-wide summary list (admin/tooling review). */
  @Get('all')
  all(@Identity() id: RequestIdentity) {
    return this.testRuns.listAll(id.tenantId);
  }

  /** PUT /api/testruns — upsert results for the current tenant+user. */
  @Put()
  put(@Body() body: PutTestRunDto, @Identity() id: RequestIdentity) {
    return this.testRuns.put(id.tenantId, id.userId, body?.results ?? {}, body?.meta);
  }

  /**
   * POST /api/testruns/evidence — save a pasted/uploaded screenshot as
   * evidence for one test-case row (paste-to-attach flow in the console UI).
   */
  @Post('evidence')
  postEvidence(@Body() body: PostEvidenceDto, @Identity() id: RequestIdentity) {
    if (!body?.testCaseId || !body?.contentBase64 || !body?.mimeType) {
      throw new BadRequestException('testCaseId, contentBase64 and mimeType are required');
    }
    return this.testRuns.putEvidence(id.tenantId, id.userId, body.testCaseId, body.contentBase64, body.mimeType);
  }

  /**
   * GET /api/testruns/evidence/:userId/:testCaseId/:filename — read back a
   * saved evidence image. Scoped by tenantId only (not by requesting userId)
   * so any tester in the tenant can review evidence attached by teammates.
   */
  @Get('evidence/:userId/:testCaseId/:filename')
  getEvidence(
    @Param('userId') userId: string,
    @Param('testCaseId') testCaseId: string,
    @Param('filename') filename: string,
    @Identity() id: RequestIdentity,
  ) {
    return this.testRuns.getEvidence(id.tenantId, userId, testCaseId, filename);
  }
}
