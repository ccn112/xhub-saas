import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProjectCatalogService } from './project-catalog.service';

/**
 * Global Project Catalog API (Wave A). No `/v1` segment, no
 * TenantScopeInterceptor, no @RequirePermission — flat `api/catalog/projects`
 * matching this repo's route convention (see
 * docs/geo-migration/XHUB_GEO_READINESS_AUDIT.md §7), and intentionally
 * public/unauthenticated like X2's own public project API.
 */
@Controller('api/catalog/projects')
export class ProjectCatalogController {
  constructor(private readonly catalog: ProjectCatalogService) {}

  @Get()
  list(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.catalog.listProjects({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.catalog.getProject(id);
  }

  @Get(':id/nearby')
  nearby(
    @Param('id') id: string,
    @Query('radius_m') radiusM?: string,
    @Query('category') category?: string,
    @Query('verified_only') verifiedOnly?: string,
    @Query('partner_only') partnerOnly?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.catalog.getNearby(id, {
      radiusM: radiusM ? Number(radiusM) : undefined,
      category,
      verifiedOnly: verifiedOnly === 'true',
      partnerOnly: partnerOnly === 'true',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id/supply-graph')
  supplyGraph(@Param('id') id: string) {
    return this.catalog.getSupplyGraph(id);
  }

  @Get(':id/providers')
  providers(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.catalog.getProviders(id, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
