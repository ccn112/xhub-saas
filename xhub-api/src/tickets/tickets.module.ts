import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RecordsModule } from '../records/records.module';
import { IdentityModule } from '../identity/identity.module';
import { TenantScopeInterceptor } from '../xoffice/tenant-scope.interceptor';

/**
 * Tickets / Service Desk module (PH-02c — NX-026). Additive. Reuses:
 *  - RecordsModule  → attachments (RecordDocument subjectType=Ticket)
 *  - IdentityModule → AssignmentResolver (agent-queue routing) + IdentityService
 *  - the shared RLS PrismaService (tenant-scoped) + XOffice TenantScopeInterceptor.
 */
@Module({
  imports: [PrismaModule, RecordsModule, IdentityModule],
  controllers: [TicketsController],
  providers: [TicketsService, TenantScopeInterceptor],
  exports: [TicketsService],
})
export class TicketsModule {}
