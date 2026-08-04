import { Module } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementsController } from './announcements.controller';
import { XofficePrismaModule } from '../xoffice-prisma/xoffice-prisma.module';
import { RecordsModule } from '../records/records.module';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';

/**
 * Announcements / read-acknowledgement module (PH-02e — NX-028). Additive. Reuses:
 *  - RecordsModule → attachments (RecordDocument subjectType=Announcement)
 *  - AssignmentResolver (audience resolution) + IdentityService — global
 *    providers from IdentityModule.forPlatform()/forXoffice() (Stage C.5).
 *  - the shared RLS XofficePrismaService (tenant-scoped) + XOffice XofficeTenantScopeInterceptor.
 * Authoring/publish is a COMM_ADMIN permission (announcement.publish); publish
 * resolves the audience into AnnouncementReceipts (never a hardcoded audience).
 */
@Module({
  imports: [XofficePrismaModule, RecordsModule],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService, XofficeTenantScopeInterceptor],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
