import { Module } from '@nestjs/common';
import { TestRunsService } from './testruns.service';
import { TestRunsController } from './testruns.controller';

/**
 * TestRuns — server-side persistence for the /docs/test QA checklist. Additive
 * module. NO Prisma / no DB table (file-per-tenant+user JSON under storage/),
 * so the fixed RLS table set and existing smokes stay unchanged.
 */
@Module({
  controllers: [TestRunsController],
  providers: [TestRunsService],
  exports: [TestRunsService],
})
export class TestRunsModule {}
