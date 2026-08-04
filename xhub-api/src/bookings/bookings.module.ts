import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RecordsModule } from '../records/records.module';
import { TenantScopeInterceptor } from '../common/tenant-scope.interceptor';

/**
 * Bookings / resource booking module (PH-02d — NX-027). Additive. Reuses:
 *  - RecordsModule → attachments (RecordDocument subjectType=Booking)
 *  - the shared RLS PrismaService (tenant-scoped) + XOffice TenantScopeInterceptor.
 * Approval is a manager permission (booking.manage); the CONFLICT rule (409 on
 * overlap) is enforced in the service on create + approve.
 */
@Module({
  imports: [PrismaModule, RecordsModule],
  controllers: [BookingsController],
  providers: [BookingsService, TenantScopeInterceptor],
  exports: [BookingsService],
})
export class BookingsModule {}
