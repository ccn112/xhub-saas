import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { TestResultsService } from './test-results.service';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';

/**
 * Engineering Governance — record/read TestResult (DG-04-lite). Intentionally
 * ungated (no @RequirePermission) — matches the existing /docs/test
 * checklist's own posture: any authenticated user can record a PASS/FAIL for
 * a case they can see, same as today.
 */
@Controller('api/engineering/test-results')
export class TestResultsController {
  constructor(private readonly results: TestResultsService) {}

  @Get()
  history(@Query('testCaseId') testCaseId: string) {
    return this.results.history(testCaseId);
  }

  @Post()
  record(
    @Body()
    body: { testCaseId: string; productVersionId?: string; status: string; actualResult?: string; notes?: string; environment?: string },
    @Identity() id: RequestIdentity,
  ) {
    return this.results.record({ ...body, testerUserId: id.userId });
  }
}
