import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';

/**
 * DATA-03 Equipment/Product Master API (Wave A). No `/v1`, no
 * TenantScopeInterceptor — see products.service.ts docblock. Mirrors
 * src/project-catalog's flat `api/catalog/*` route convention.
 */
@Controller('api/catalog/products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('categoryCode') categoryCode?: string,
    @Query('manufacturerOrgId') manufacturerOrgId?: string,
  ) {
    return this.products.list({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      q,
      categoryCode,
      manufacturerOrgId,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.products.getById(id);
  }

  @Get(':id/specs')
  specs(@Param('id') id: string) {
    return this.products.getSpecs(id);
  }

  @Get(':id/suppliers')
  suppliers(@Param('id') id: string) {
    return this.products.getSuppliers(id);
  }

  @Get(':id/prices')
  prices(@Param('id') id: string) {
    return this.products.getPrices(id);
  }
}
