import { Controller, Get, Param } from '@nestjs/common';
import { ProvidersService } from './providers.service';

/** Provider/Catalog API (Wave A). Public, no auth — see project-catalog.controller.ts. */
@Controller('api/providers')
export class ProvidersController {
  constructor(private readonly providers: ProvidersService) {}

  @Get(':id')
  get(@Param('id') id: string) {
    return this.providers.getProvider(id);
  }

  @Get(':id/catalog')
  catalog(@Param('id') id: string) {
    return this.providers.getCatalog(id);
  }
}
