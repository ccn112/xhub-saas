import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { XofficePrismaModule } from '../xoffice-prisma/xoffice-prisma.module';
import { RecordsModule } from '../records/records.module';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';

/**
 * Bookings / resource booking module (PH-02d — NX-027). Additive. Reuses:
 *  - RecordsModule → attachments (RecordDocument subjectType=Booking)
 *  - the shared RLS XofficePrismaService (tenant-scoped, X.Office's own
 *    database — Phase 1.5 Stage C) + XofficeTenantScopeInterceptor.
 * Approval is a manager permission (booking.manage); the CONFLICT rule (409 on
 * overlap) is enforced in the service on create + approve.
 */
@Module({
  imports: [XofficePrismaModule, RecordsModule],
  controllers: [BookingsController],
  providers: [BookingsService, XofficeTenantScopeInterceptor],
  exports: [BookingsService],
})
export class BookingsModule {}
