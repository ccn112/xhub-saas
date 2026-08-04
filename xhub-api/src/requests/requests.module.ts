import { Module } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { RequestsController } from './requests.controller';
import { XofficePrismaModule } from '../xoffice-prisma/xoffice-prisma.module';
import { RecordsModule } from '../records/records.module';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';

/**
 * Requests module (PH-02a — NX-020..024). Additive. Reuses:
 *  - RecordsModule → attachments + evidence (RecordDocument subjectType=Request)
 *  - AssignmentResolver (approval routing) + IdentityService (ABAC) — global
 *    providers from IdentityModule.forPlatform()/forXoffice() (Stage C.5).
 *  - the shared RLS XofficePrismaService (tenant-scoped) + XOffice XofficeTenantScopeInterceptor.
 */
@Module({
  imports: [XofficePrismaModule, RecordsModule],
  controllers: [RequestsController],
  providers: [RequestsService, XofficeTenantScopeInterceptor],
  exports: [RequestsService],
})
export class RequestsModule {}
