import { Module } from '@nestjs/common';
import { CommercialCatalogService } from './commercial-catalog.service';
import { CommercialCatalogController } from './commercial-catalog.controller';
import { XofficePrismaModule } from '../xoffice-prisma/xoffice-prisma.module';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';

/**
 * Commercial Catalog module (Phase 2, BO-0203). X.Office-only, additive.
 * Named CommercialCatalogModule (not CatalogModule) to avoid confusion with
 * the unrelated Platform-side blueprint CatalogModule (different process,
 * different DB — no actual collision, but same name would be misleading).
 */
@Module({
  imports: [XofficePrismaModule],
  controllers: [CommercialCatalogController],
  providers: [CommercialCatalogService, XofficeTenantScopeInterceptor],
  exports: [CommercialCatalogService],
})
export class CommercialCatalogModule {}
