import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { RequirePermission } from '../../auth/require-permission.decorator';

/**
 * Platform Console — Blueprint & Seed Pack catalog API. Platform plane (SHARED
 * tables via withBypass) — NO TenantScopeInterceptor. Gated by the platform
 * catalog permission codes; PLT_BLUEPRINT_MANAGER (`platform.blueprint.*` /
 * `platform.seed-pack.*`) and the wildcard PLATFORM_ADMIN satisfy them.
 */
@Controller('api/platform/blueprints')
export class BlueprintController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @RequirePermission('platform.blueprint.read')
  list() {
    return this.catalog.listBlueprints();
  }

  @Get(':id')
  @RequirePermission('platform.blueprint.read')
  get(@Param('id') id: string) {
    return this.catalog.getBlueprintById(id);
  }

  @Post()
  @RequirePermission('platform.blueprint.manage')
  create(@Body() body: any) {
    return this.catalog.createBlueprint(body);
  }

  @Patch(':id')
  @RequirePermission('platform.blueprint.manage')
  patch(@Param('id') id: string, @Body() body: any) {
    return this.catalog.patchBlueprint(id, body);
  }

  @Post(':id/publish')
  @RequirePermission('platform.blueprint.manage')
  publish(@Param('id') id: string) {
    return this.catalog.publishBlueprint(id);
  }
}

@Controller('api/platform/seed-packs')
export class SeedPackController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @RequirePermission('platform.seed-pack.read')
  list() {
    return this.catalog.listSeedPacks();
  }

  @Get(':id')
  @RequirePermission('platform.seed-pack.read')
  get(@Param('id') id: string) {
    return this.catalog.getSeedPackById(id);
  }

  @Post()
  @RequirePermission('platform.seed-pack.manage')
  create(@Body() body: any) {
    return this.catalog.createSeedPack(body);
  }

  @Post(':id/publish')
  @RequirePermission('platform.seed-pack.manage')
  publish(@Param('id') id: string) {
    return this.catalog.publishSeedPack(id);
  }
}
