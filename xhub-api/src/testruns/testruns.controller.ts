import { Body, Controller, Get, Put } from '@nestjs/common';
import { TestRunsService } from './testruns.service';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';

interface PutTestRunDto {
  results?: Record<string, unknown>;
  meta?: Record<string, unknown>;
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
}
