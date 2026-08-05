import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AiGovernanceService } from './ai-governance.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';

/** Engineering Governance — AI System Registry + Impact Assessment (DG-10). Reads open; writes gated `engineering.ai-governance.manage`. */
@Controller('api/engineering/ai-systems')
export class AiGovernanceController {
  constructor(private readonly ai: AiGovernanceService) {}

  @Get()
  list(@Query('productId') productId?: string) {
    return this.ai.listSystems(productId);
  }

  @Get(':idOrCode')
  get(@Param('idOrCode') idOrCode: string) {
    return this.ai.getSystem(idOrCode);
  }

  @Post()
  @RequirePermission('engineering.ai-governance.manage')
  create(
    @Body()
    body: {
      code: string;
      productId: string;
      name: string;
      purpose?: string;
      provider?: string;
      riskTier?: string;
      humanOversight?: string;
      standardsRefs?: string[];
    },
    @Identity() id: RequestIdentity,
  ) {
    return this.ai.createSystem({ ...body, actorId: id.userId });
  }

  @Patch(':id/status')
  @RequirePermission('engineering.ai-governance.manage')
  setStatus(@Param('id') id_: string, @Body() body: { status: string }, @Identity() id: RequestIdentity) {
    return this.ai.setSystemStatus(id_, body.status, id.userId);
  }

  @Post(':id/impact-assessments')
  @RequirePermission('engineering.ai-governance.manage')
  createAssessment(@Param('id') id_: string, @Identity() id: RequestIdentity) {
    return this.ai.createAssessment(id_, id.userId);
  }

  @Patch('impact-assessments/:id/status')
  @RequirePermission('engineering.ai-governance.manage')
  transitionAssessment(
    @Param('id') id_: string,
    @Body() body: { status: string; risksIdentified?: string; mitigations?: string; approverRole?: string },
    @Identity() id: RequestIdentity,
  ) {
    return this.ai.transitionAssessment(id_, body.status, id.userId, body);
  }
}
