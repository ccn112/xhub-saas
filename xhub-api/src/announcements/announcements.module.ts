import { Module } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementsController } from './announcements.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RecordsModule } from '../records/records.module';
import { IdentityModule } from '../identity/identity.module';
import { TenantScopeInterceptor } from '../xoffice/tenant-scope.interceptor';

/**
 * Announcements / read-acknowledgement module (PH-02e — NX-028). Additive. Reuses:
 *  - RecordsModule  → attachments (RecordDocument subjectType=Announcement)
 *  - IdentityModule → AssignmentResolver (audience resolution) + IdentityService
 *  - the shared RLS PrismaService (tenant-scoped) + XOffice TenantScopeInterceptor.
 * Authoring/publish is a COMM_ADMIN permission (announcement.publish); publish
 * resolves the audience into AnnouncementReceipts (never a hardcoded audience).
 */
@Module({
  imports: [PrismaModule, RecordsModule, IdentityModule],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService, TenantScopeInterceptor],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
