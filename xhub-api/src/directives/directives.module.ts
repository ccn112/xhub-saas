import { Module } from '@nestjs/common';
import { DirectivesService } from './directives.service';
import { DirectivesController } from './directives.controller';
import { XofficePrismaModule } from '../xoffice-prisma/xoffice-prisma.module';
import { RecordsModule } from '../records/records.module';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';

/**
 * Directives module (PH-02b — NX-025). Additive. Reuses:
 *  - RecordsModule → evidence (RecordDocument subjectType=Directive)
 *  - AssignmentResolver (audience routing) + IdentityService — global
 *    providers from IdentityModule.forPlatform()/forXoffice() (Stage C.5).
 *  - the shared RLS XofficePrismaService (tenant-scoped) + XOffice XofficeTenantScopeInterceptor.
 */
@Module({
  imports: [XofficePrismaModule, RecordsModule],
  controllers: [DirectivesController],
  providers: [DirectivesService, XofficeTenantScopeInterceptor],
  exports: [DirectivesService],
})
export class DirectivesModule {}
