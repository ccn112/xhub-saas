import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { BacklogService } from './backlog.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';

/** Engineering Governance — BacklogItem registry + FSM (DG-02). */
@Controller('api/engineering/backlog')
export class BacklogController {
  constructor(private readonly backlog: BacklogService) {}

  @Get()
  list(@Query('productId') productId: string, @Query('status') status?: string, @Query('targetVersionId') targetVersionId?: string) {
    return this.backlog.list(productId, { status, targetVersionId });
  }

  @Get(':idOrCode')
  get(@Param('idOrCode') idOrCode: string) {
    return this.backlog.get(idOrCode);
  }

  @Post()
  @RequirePermission('engineering.backlog.manage')
  create(
    @Body()
    body: {
      productId: string;
      featureId?: string;
      code: string;
      title: string;
      description?: string;
      type?: string;
      priority?: string;
      targetVersionId?: string;
    },
    @Identity() id: RequestIdentity,
  ) {
    return this.backlog.create({ ...body, actorId: id.userId });
  }

  @Patch(':id/status')
  @RequirePermission('engineering.backlog.manage')
  transition(@Param('id') id_: string, @Body() body: { status: string }, @Identity() id: RequestIdentity) {
    return this.backlog.transition(id_, body.status, id.userId);
  }
}
