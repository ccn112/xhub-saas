import { Module } from '@nestjs/common';
import { XofficePrismaModule } from '../xoffice-prisma/xoffice-prisma.module';
import { XofficeModule } from '../xoffice/xoffice.module';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';
import { OutboxHttpClient } from '../common/outbox-http.client';
import { PeopleConfigService } from './config.service';
import { LeavePolicyService } from './leave-policy.service';
import { LeaveBalanceService } from './leave-balance.service';
import { LeaveImpactService } from './leave-impact.service';
import { LeaveService } from './leave.service';
import { AvailabilityService } from './availability.service';
import { OvertimeService } from './overtime.service';
import { WorkCalendarService } from './work-calendar.service';
import { ShiftService } from './shift.service';
import { AttendanceDayService } from './attendance-day.service';
import { AttendanceImportService } from './attendance-import.service';
import { AttendanceCorrectionService } from './attendance-correction.service';
import {
  PeopleConfigController,
  LeavePolicyController,
  PeopleMeController,
  LeaveRequestsController,
  PeopleTeamController,
  OvertimeRequestsController,
  WorkCalendarController,
  ShiftPatternsController,
  ShiftAssignmentsController,
  AttendanceImportsController,
  AttendanceController,
  AttendanceCorrectionsController,
} from './people.controllers';

/**
 * People Essentials — PE-01 "Leave & Availability" + PE-02 "Attendance &
 * Correction". Operating mode SME Lite (PE-001, owner-approved 2026-08-01):
 * attendance enters ONLY via file import (no live clock device/connector).
 * Additive: reuses the shared RLS XofficePrismaService, XOffice
 * XofficeTenantScopeInterceptor, and IdentityService (DataScope/Position/OrgUnit,
 * global provider — Stage C.5) — no second ABAC or approval mechanism.
 */
@Module({
  imports: [XofficePrismaModule, XofficeModule],
  controllers: [
    PeopleConfigController,
    LeavePolicyController,
    PeopleMeController,
    LeaveRequestsController,
    PeopleTeamController,
    OvertimeRequestsController,
    WorkCalendarController,
    ShiftPatternsController,
    ShiftAssignmentsController,
    AttendanceImportsController,
    AttendanceController,
    AttendanceCorrectionsController,
  ],
  providers: [
    PeopleConfigService,
    LeavePolicyService,
    LeaveBalanceService,
    LeaveImpactService,
    LeaveService,
    AvailabilityService,
    OvertimeService,
    WorkCalendarService,
    ShiftService,
    AttendanceDayService,
    AttendanceImportService,
    AttendanceCorrectionService,
    XofficeTenantScopeInterceptor,
    OutboxHttpClient,
  ],
  exports: [PeopleConfigService, LeaveBalanceService, LeaveService, AvailabilityService, AttendanceDayService],
})
export class PeopleModule {}
