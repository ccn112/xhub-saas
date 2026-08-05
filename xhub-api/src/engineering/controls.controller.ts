import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { ControlsService } from './controls.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';

/** Engineering Governance — Unified Control Framework (DG-09). Reads open; writes gated `engineering.control.manage`. */
@Controller('api/engineering/controls')
export class ControlsController {
  constructor(private readonly controls: ControlsService) {}

  @Get()
  list(@Query('domain') domain?: string) {
    return this.controls.listControls(domain);
  }

  @Post()
  @RequirePermission('engineering.control.manage')
  create(
    @Body() body: { code: string; domain: string; title: string; description?: string; frameworkFamilies?: string[] },
  ) {
    return this.controls.createControl(body);
  }

  @Get('implementations')
  listImplementations(@Query('productId') productId: string) {
    return this.controls.listImplementations(productId);
  }

  @Put('implementations')
  @RequirePermission('engineering.control.manage')
  setImplementation(
    @Body() body: { controlId: string; productId: string; status: string; evidenceRefs?: string[]; notes?: string },
    @Identity() id: RequestIdentity,
  ) {
    return this.controls.setImplementation({ ...body, actorId: id.userId });
  }
}
