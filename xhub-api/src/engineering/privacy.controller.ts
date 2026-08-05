import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PrivacyService } from './privacy.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';

/** Engineering Governance — Processing Activity Registry + DPIA (DG-11). Reads open; writes gated `engineering.privacy.manage`. */
@Controller('api/engineering/processing-activities')
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get()
  list(@Query('productId') productId?: string) {
    return this.privacy.listActivities(productId);
  }

  @Get(':idOrCode')
  get(@Param('idOrCode') idOrCode: string) {
    return this.privacy.getActivity(idOrCode);
  }

  @Post()
  @RequirePermission('engineering.privacy.manage')
  create(
    @Body()
    body: {
      code: string;
      productId: string;
      name: string;
      purpose?: string;
      dataCategories?: string[];
      legalBasis?: string;
      standardsRefs?: string[];
    },
    @Identity() id: RequestIdentity,
  ) {
    return this.privacy.createActivity({ ...body, actorId: id.userId });
  }

  @Patch(':id/status')
  @RequirePermission('engineering.privacy.manage')
  setStatus(@Param('id') id_: string, @Body() body: { status: string }, @Identity() id: RequestIdentity) {
    return this.privacy.setActivityStatus(id_, body.status, id.userId);
  }

  @Post(':id/assessments')
  @RequirePermission('engineering.privacy.manage')
  createAssessment(@Param('id') id_: string, @Identity() id: RequestIdentity) {
    return this.privacy.createAssessment(id_, id.userId);
  }

  @Patch('assessments/:id/status')
  @RequirePermission('engineering.privacy.manage')
  transitionAssessment(
    @Param('id') id_: string,
    @Body() body: { status: string; risksIdentified?: string; mitigations?: string; approverRole?: string },
    @Identity() id: RequestIdentity,
  ) {
    return this.privacy.transitionAssessment(id_, body.status, id.userId, body);
  }
}
