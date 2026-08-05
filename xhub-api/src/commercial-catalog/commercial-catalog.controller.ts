import { Body, Controller, Get, Param, Patch, Post, Query, UseInterceptors } from '@nestjs/common';
import { CommercialCatalogService } from './commercial-catalog.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';

/** Commercial Catalog API (Phase 2, BO-0203). Reads open; writes gated `catalog.manage`. */
@Controller('api/commercial-catalog')
@UseInterceptors(XofficeTenantScopeInterceptor)
export class CommercialCatalogController {
  constructor(private readonly svc: CommercialCatalogService) {}

  private tenant(id: RequestIdentity): string {
    return id.tenantId ?? 'tenant-xtech';
  }
  private user(id: RequestIdentity): string {
    return id.userId ?? 'user-nam';
  }

  @Get()
  list(@Identity() id: RequestIdentity, @Query('active') active?: string, @Query('commercialType') commercialType?: string) {
    return this.svc.list(this.tenant(id), { active: active === undefined ? undefined : active === 'true', commercialType });
  }

  @Get(':idOrCode')
  get(@Param('idOrCode') idOrCode: string, @Identity() ident: RequestIdentity) {
    return this.svc.get(this.tenant(ident), idOrCode);
  }

  @Post()
  @RequirePermission('catalog.manage')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(this.tenant(id), this.user(id), body);
  }

  @Patch(':id')
  @RequirePermission('catalog.manage')
  update(@Param('id') id: string, @Body() body: any, @Identity() ident: RequestIdentity) {
    return this.svc.update(this.tenant(ident), this.user(ident), id, body);
  }
}
