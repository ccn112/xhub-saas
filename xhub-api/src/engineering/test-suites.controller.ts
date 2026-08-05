import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { TestSuitesService } from './test-suites.service';
import { RequirePermission } from '../auth/require-permission.decorator';

/** Engineering Governance — TestSuite ("Module") registry (DG-04-lite). */
@Controller('api/engineering/test-suites')
export class TestSuitesController {
  constructor(private readonly suites: TestSuitesService) {}

  @Get()
  list(@Query('productId') productId: string) {
    return this.suites.listForProduct(productId);
  }

  @Post()
  @RequirePermission('engineering.test.manage')
  create(@Body() body: { productId: string; name: string }) {
    return this.suites.create(body);
  }
}
