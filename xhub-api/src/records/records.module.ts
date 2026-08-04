import { Module } from '@nestjs/common';
import { RecordsService } from './records.service';
import { RecordsController } from './records.controller';
import { StorageService } from './storage.service';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';
import { XofficePrismaModule } from '../xoffice-prisma/xoffice-prisma.module';

/**
 * Records / Documents + object storage (Mục 8a). Additive module. Reuses the RLS
 * XofficePrismaService (tenant-scoped, X.Office's own database — Phase 1.5
 * Stage C) and a folder-per-tenant StorageService.
 */
@Module({
  imports: [XofficePrismaModule],
  controllers: [RecordsController],
  providers: [RecordsService, StorageService, XofficeTenantScopeInterceptor],
  exports: [RecordsService],
})
export class RecordsModule {}
