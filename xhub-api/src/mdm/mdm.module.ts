import { Module } from '@nestjs/common';
import { MdmService } from './mdm.service';
import { MdmController } from './mdm.controller';
import { TenantScopeInterceptor } from '../common/tenant-scope.interceptor';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Shared Master Data Hub (MDM) + tenant overlay + X2BMS project ingestion
 * pipeline (S3–S4). Additive module. Reuses the RLS PrismaService; MasterRecord
 * is the shared platform canonical, the other tables are tenant-scoped (RLS).
 */
@Module({
  imports: [PrismaModule],
  controllers: [MdmController],
  providers: [MdmService, TenantScopeInterceptor],
  exports: [MdmService],
})
export class MdmModule {}
