import { Controller, Get, Header, NotFoundException, Param } from '@nestjs/common';
import { SeedService } from './seed.service';

/**
 * Tenant-scoped read API. Tenant comes from the URL path; every response is
 * filtered to that tenant and guarded against MUST_NOT_LEAK rows.
 * Frontend calls these endpoints instead of touching any datastore.
 */
@Controller('api/tenants/:tenantId')
export class SeedController {
  constructor(private readonly seed: SeedService) {}

  @Get('meta')
  meta() {
    return this.seed.getMeta();
  }

  @Get('collections')
  names() {
    return this.seed.listNames();
  }

  @Get('collections/:name')
  collection(@Param('tenantId') tenantId: string, @Param('name') name: string) {
    return this.seed.collection(name, tenantId);
  }

  @Get('collections/:name/:id')
  one(
    @Param('tenantId') tenantId: string,
    @Param('name') name: string,
    @Param('id') id: string,
  ) {
    const row = this.seed.byId(name, id, tenantId);
    if (!row) throw new NotFoundException(`${name}/${id} not found in ${tenantId}`);
    return row;
  }
}
