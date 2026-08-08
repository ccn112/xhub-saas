import { Controller, Get, Param, Query } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';

/**
 * DATA-01 Organization Master API (Wave A). No `/v1`, no
 * TenantScopeInterceptor — see organizations.service.ts docblock.
 */
@Controller('api/mdm/organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('researchStatus') researchStatus?: string,
    @Query('organizationType') organizationType?: string,
  ) {
    return this.organizations.list({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      q,
      researchStatus,
      organizationType,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.organizations.getById(id);
  }

  @Get(':id/qualifications')
  qualifications(@Param('id') id: string) {
    return this.organizations.getQualifications(id);
  }

  @Get(':id/projects')
  projects(@Param('id') id: string) {
    return this.organizations.getProjects(id);
  }
}
