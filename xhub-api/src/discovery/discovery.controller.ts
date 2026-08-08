import { Controller, Get, Query } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';

/** Discovery API (Wave A) — doc §11. Public, no auth. */
@Controller('api/discovery')
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Get('nearby')
  nearby(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radius_m') radiusM?: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.discovery.nearby({
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
      radiusM: radiusM ? Number(radiusM) : undefined,
      category,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('search')
  search(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.discovery.search({
      q,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
