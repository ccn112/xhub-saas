import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * DATA-03 Equipment/Product Master (Wave A). Reads EquipmentProduct/
 * ProductSpec/OrganizationProductRelation/ProductPriceObservation — global,
 * non-RLS tables (see prisma/schema.prisma's DATA-03 block comment) — so no
 * TenantScopeInterceptor here, same as OrganizationsModule/ProjectCatalogModule.
 */
@Module({
  imports: [PrismaModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
