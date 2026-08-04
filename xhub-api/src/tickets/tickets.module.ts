import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { XofficePrismaModule } from '../xoffice-prisma/xoffice-prisma.module';
import { RecordsModule } from '../records/records.module';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';

/**
 * Tickets / Service Desk module (PH-02c — NX-026). Additive. Reuses:
 *  - RecordsModule → attachments (RecordDocument subjectType=Ticket)
 *  - AssignmentResolver (agent-queue routing) + IdentityService — global
 *    providers from IdentityModule.forPlatform()/forXoffice() (Stage C.5).
 *  - the shared RLS XofficePrismaService (tenant-scoped) + XOffice XofficeTenantScopeInterceptor.
 */
@Module({
  imports: [XofficePrismaModule, RecordsModule],
  controllers: [TicketsController],
  providers: [TicketsService, XofficeTenantScopeInterceptor],
  exports: [TicketsService],
})
export class TicketsModule {}
