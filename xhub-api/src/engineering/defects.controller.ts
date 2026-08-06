import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { DefectsService } from './defects.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';

/**
 * Engineering Governance — Defect registry + FSM (DG-05). `create()` is
 * intentionally NOT @RequirePermission-gated — filing a defect is the direct
 * next step after recording a FAIL TestResult, which is itself open (see
 * TestResultsController); gating it would dead-end the "Báo lỗi" button for
 * any tester who can already record results. `transition()` (triage/RCA/
 * close) IS gated — that is the real governance action.
 */
@Controller('api/engineering/defects')
export class DefectsController {
  constructor(private readonly defects: DefectsService) {}

  @Get()
  list(@Query('productId') productId: string, @Query('status') status?: string, @Query('severity') severity?: string) {
    return this.defects.list(productId, { status, severity });
  }

  @Get(':idOrCode')
  get(@Param('idOrCode') idOrCode: string) {
    return this.defects.get(idOrCode);
  }

  @Post()
  create(
    @Body()
    body: {
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
      sourceSystem?: string;
      sourceRef?: string;
      correlationId?: string;
    },
    @Identity() id: RequestIdentity,
  ) {
    return this.defects.create({ ...body, actorId: id.userId });
  }

  @Patch(':id/status')
  @RequirePermission('engineering.defect.manage')
  transition(
    @Param('id') id_: string,
    @Body() body: { status: string; rootCause?: string },
    @Identity() id: RequestIdentity,
  ) {
    return this.defects.transition(id_, body.status, id.userId, body.rootCause);
  }
}
