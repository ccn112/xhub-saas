import { Module } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { RequestsController } from './requests.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RecordsModule } from '../records/records.module';
import { IdentityModule } from '../identity/identity.module';
import { TenantScopeInterceptor } from '../common/tenant-scope.interceptor';

/**
 * Requests module (PH-02a — NX-020..024). Additive. Reuses:
 *  - RecordsModule  → attachments + evidence (RecordDocument subjectType=Request)
 *  - IdentityModule → AssignmentResolver (approval routing) + IdentityService (ABAC)
 *  - the shared RLS PrismaService (tenant-scoped) + XOffice TenantScopeInterceptor.
 */
@Module({
  imports: [PrismaModule, RecordsModule, IdentityModule],
  controllers: [RequestsController],
  providers: [RequestsService, TenantScopeInterceptor],
  exports: [RequestsService],
})
export class RequestsModule {}
