import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ProductsService } from './products.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';

/**
 * Engineering Governance — Product Registry (DG-01). Platform plane, no
 * TenantScopeInterceptor (see products.service.ts docblock). Reads open;
 * writes gated `engineering.product.manage`.
 */
@Controller('api/engineering/products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list() {
    return this.products.list();
  }

  @Get(':idOrCode')
  get(@Param('idOrCode') idOrCode: string) {
    return this.products.get(idOrCode);
  }

  @Post()
  @RequirePermission('engineering.product.manage')
  create(
    @Body()
    body: {
      code: string;
      name: string;
      type?: string;
      ownerRole?: string;
      versionPolicy?: string;
      description?: string;
      rolloutOrder?: number;
    },
    @Identity() id: RequestIdentity,
  ) {
    return this.products.create({ ...body, actorId: id.userId });
  }
}
