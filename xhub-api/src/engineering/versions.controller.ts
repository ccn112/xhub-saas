import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { VersionsService } from './versions.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';

/** Engineering Governance — ProductVersion registry + FSM (DG-01). */
@Controller('api/engineering')
export class VersionsController {
  constructor(private readonly versions: VersionsService) {}

  @Get('products/:productId/versions')
  listForProduct(@Param('productId') productId: string) {
    return this.versions.listForProduct(productId);
  }

  @Post('products/:productId/versions')
  @RequirePermission('engineering.version.manage')
  create(
    @Param('productId') productId: string,
    @Body() body: { version: string; releaseTrainId?: string; releaseChannel?: string },
    @Identity() id: RequestIdentity,
  ) {
    return this.versions.create(productId, { ...body, actorId: id.userId });
  }

  @Patch('versions/:id')
  @RequirePermission('engineering.version.manage')
  transition(@Param('id') id_: string, @Body() body: { status: string }, @Identity() id: RequestIdentity) {
    return this.versions.transition(id_, body.status, id.userId);
  }
}
