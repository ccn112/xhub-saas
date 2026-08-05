import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { FeaturesService } from './features.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';

/** Engineering Governance — Feature registry (DG-02). Reads open; writes gated `engineering.backlog.manage`. */
@Controller('api/engineering/features')
export class FeaturesController {
  constructor(private readonly features: FeaturesService) {}

  @Get()
  list(@Query('productId') productId: string) {
    return this.features.listForProduct(productId);
  }

  @Get(':idOrCode')
  get(@Param('idOrCode') idOrCode: string) {
    return this.features.get(idOrCode);
  }

  @Post()
  @RequirePermission('engineering.backlog.manage')
  create(
    @Body()
    body: { productId: string; code: string; title: string; description?: string; targetVersionId?: string; standardsRefs?: string[] },
    @Identity() id: RequestIdentity,
  ) {
    return this.features.create({ ...body, actorId: id.userId });
  }

  @Patch(':id/status')
  @RequirePermission('engineering.backlog.manage')
  setStatus(@Param('id') id_: string, @Body() body: { status: string }, @Identity() id: RequestIdentity) {
    return this.features.setStatus(id_, body.status, id.userId);
  }
}
