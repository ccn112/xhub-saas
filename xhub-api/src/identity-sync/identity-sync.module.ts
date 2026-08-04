import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { IdentitySyncService } from './identity-sync.service';
import { IdentitySyncScheduler } from './identity-sync.scheduler';
import { IdentitySyncController } from './identity-sync.controller';
import { XofficePrismaModule } from '../xoffice-prisma/xoffice-prisma.module';

/**
 * Phase 1.5 Stage C.4 — periodic PersonProfile/OrgUnit/Position/Group cache
 * sync from XHub Platform into X.Office's own database. X.Office-process-only
 * (not imported by platform-app.module.ts).
 */
@Module({
  imports: [ScheduleModule.forRoot(), XofficePrismaModule],
  controllers: [IdentitySyncController],
  providers: [IdentitySyncService, IdentitySyncScheduler],
  exports: [IdentitySyncService],
})
export class IdentitySyncModule {}
