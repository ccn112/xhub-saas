import { Module } from '@nestjs/common';
import { ProjectCatalogService } from './project-catalog.service';
import { ProjectCatalogController } from './project-catalog.controller';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Global Project Catalog (Wave A / Hapulico golden slice). See
 * docs/geo-migration/*.md. Reads GlobalProject/Place/Provider — global,
 * non-RLS tables (see prisma/schema.prisma's Geo/Provider block comment) — so
 * no TenantScopeInterceptor here, unlike most other feature modules.
 */
@Module({
  imports: [PrismaModule],
  controllers: [ProjectCatalogController],
  providers: [ProjectCatalogService],
  exports: [ProjectCatalogService],
})
export class ProjectCatalogModule {}
