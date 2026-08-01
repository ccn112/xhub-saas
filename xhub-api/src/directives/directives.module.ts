import { Module } from '@nestjs/common';
import { DirectivesService } from './directives.service';
import { DirectivesController } from './directives.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RecordsModule } from '../records/records.module';
import { IdentityModule } from '../identity/identity.module';
import { TenantScopeInterceptor } from '../xoffice/tenant-scope.interceptor';

/**
 * Directives module (PH-02b — NX-025). Additive. Reuses:
 *  - RecordsModule  → evidence (RecordDocument subjectType=Directive)
 *  - IdentityModule → AssignmentResolver (audience routing) + IdentityService
 *  - the shared RLS PrismaService (tenant-scoped) + XOffice TenantScopeInterceptor.
 */
@Module({
  imports: [PrismaModule, RecordsModule, IdentityModule],
  controllers: [DirectivesController],
  providers: [DirectivesService, TenantScopeInterceptor],
  exports: [DirectivesService],
})
export class DirectivesModule {}
