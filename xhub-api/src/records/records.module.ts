import { Module } from '@nestjs/common';
import { RecordsService } from './records.service';
import { RecordsController } from './records.controller';
import { StorageService } from './storage.service';
import { TenantScopeInterceptor } from '../xoffice/tenant-scope.interceptor';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Records / Documents + object storage (Mục 8a). Additive module. Reuses the RLS
 * PrismaService (tenant-scoped) and a folder-per-tenant StorageService.
 */
@Module({
  imports: [PrismaModule],
  controllers: [RecordsController],
  providers: [RecordsService, StorageService, TenantScopeInterceptor],
  exports: [RecordsService],
})
export class RecordsModule {}
