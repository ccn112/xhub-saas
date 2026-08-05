import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { TestCasesService } from './test-cases.service';
import { RequirePermission } from '../auth/require-permission.decorator';

/** Engineering Governance — TestCase registry + status projection (DG-04-lite). */
@Controller('api/engineering/test-cases')
export class TestCasesController {
  constructor(private readonly cases: TestCasesService) {}

  @Get()
  list(
    @Query('testSuiteId') testSuiteId: string,
    @Query('productVersionId') productVersionId?: string,
    @Query('status') status?: string,
  ) {
    return this.cases.listForSuite(testSuiteId, { productVersionId, status });
  }

  @Post()
  @RequirePermission('engineering.test.manage')
  create(
    @Body()
    body: {
      testSuiteId: string;
      code: string;
      title: string;
      expectedResult?: string;
      deepLinkTemplate?: string;
      level?: string;
      requiredForRelease?: boolean;
      standardsRefs?: string[];
    },
  ) {
    return this.cases.create(body);
  }
}
