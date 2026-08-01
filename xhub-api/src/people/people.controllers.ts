import { Body, Controller, Get, Param, Patch, Post, Query, UseInterceptors } from '@nestjs/common';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { TenantScopeInterceptor } from '../xoffice/tenant-scope.interceptor';
import { PeopleConfigService } from './config.service';
import { LeavePolicyService } from './leave-policy.service';
import { LeaveBalanceService } from './leave-balance.service';
import { LeaveService } from './leave.service';
import { AvailabilityService } from './availability.service';
import { OvertimeService } from './overtime.service';
import { resolveActingPerson } from './people.helpers';
import { IdentityService } from '../identity/identity.service';
import { WorkCalendarService } from './work-calendar.service';
import { ShiftService } from './shift.service';
import { AttendanceImportService } from './attendance-import.service';
import { AttendanceDayService } from './attendance-day.service';
import { AttendanceCorrectionService } from './attendance-correction.service';

/**
 * People Essentials — PE-01 (Leave & Availability) API. All routes under
 * /api/people/*, tenant-scoped via TenantScopeInterceptor (withTenant → RLS),
 * permission-gated through the global PermissionGuard (no-op unless
 * AUTH_ENFORCE). Thin controllers — logic lives in the services. Mirrors
 * ../manage/manage.controllers.ts convention exactly.
 */
function tenant(id: RequestIdentity): string {
  return id.tenantId ?? 'tenant-xtech';
}
function user(id: RequestIdentity): string {
  return id.userId ?? 'user-nam';
}

@Controller('api/people/config')
@UseInterceptors(TenantScopeInterceptor)
export class PeopleConfigController {
  constructor(private readonly svc: PeopleConfigService) {}

  @Get()
  @RequirePermission('people.hr.timekeeping.manage')
  get(@Identity() id: RequestIdentity) {
    return this.svc.get(tenant(id), user(id));
  }

  @Patch()
  @RequirePermission('people.hr.timekeeping.manage')
  update(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.update(tenant(id), user(id), body ?? {});
  }
}

@Controller('api/people/leave-policies')
@UseInterceptors(TenantScopeInterceptor)
export class LeavePolicyController {
  constructor(private readonly svc: LeavePolicyService) {}

  @Get()
  @RequirePermission('people.hr.timekeeping.manage')
  list(@Identity() id: RequestIdentity, @Query('status') status?: string) {
    return this.svc.list(tenant(id), { status });
  }

  @Post()
  @RequirePermission('people.hr.timekeeping.manage')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(tenant(id), user(id), body ?? {});
  }
}

@Controller('api/people/me')
@UseInterceptors(TenantScopeInterceptor)
export class PeopleMeController {
  constructor(
    private readonly balances: LeaveBalanceService,
    private readonly identity: IdentityService,
  ) {}

  @Get('leave-balance')
  @RequirePermission('people.self.leave.request')
  async balance(@Identity() id: RequestIdentity, @Query('periodCode') periodCode?: string) {
    const person = await resolveActingPerson(this.identity, user(id));
    return this.balances.meBalances(tenant(id), person.id, periodCode ?? this.balances.periodCodeFor(new Date()));
  }
}

@Controller('api/people/leave-requests')
@UseInterceptors(TenantScopeInterceptor)
export class LeaveRequestsController {
  constructor(private readonly svc: LeaveService) {}

  @Get()
  @RequirePermission('people.self.leave.request')
  listMine(@Identity() id: RequestIdentity, @Query('status') status?: string) {
    return this.svc.listMine(tenant(id), user(id), { status });
  }

  @Post('impact-preview')
  @RequirePermission('people.self.leave.request')
  impactPreview(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.impactPreview(tenant(id), user(id), body ?? {});
  }

  @Post()
  @RequirePermission('people.self.leave.request')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(tenant(id), user(id), body ?? {});
  }

  @Get(':id')
  @RequirePermission('people.self.leave.request')
  get(@Param('id') lid: string, @Identity() id: RequestIdentity) {
    return this.svc.get(tenant(id), user(id), lid);
  }

  @Patch(':id')
  @RequirePermission('people.self.leave.request')
  resubmit(@Param('id') lid: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.resubmit(tenant(id), user(id), lid, body ?? {});
  }

  @Post(':id/approve')
  @RequirePermission('people.team.leave.approve')
  approve(@Param('id') lid: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.approve(tenant(id), user(id), lid, body ?? {});
  }

  @Post(':id/reject')
  @RequirePermission('people.team.leave.approve')
  reject(@Param('id') lid: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.reject(tenant(id), user(id), lid, body ?? {});
  }

  @Post(':id/request-changes')
  @RequirePermission('people.team.leave.approve')
  requestChanges(@Param('id') lid: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.requestChanges(tenant(id), user(id), lid, body ?? {});
  }

  @Post(':id/cancel')
  @RequirePermission('people.self.leave.request')
  cancel(@Param('id') lid: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.cancel(tenant(id), user(id), lid, body ?? {});
  }

  @Post(':id/cancel-approve')
  @RequirePermission('people.team.leave.approve')
  cancelApprove(@Param('id') lid: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.cancelApprove(tenant(id), user(id), lid, body ?? {});
  }
}

@Controller('api/people/team')
@UseInterceptors(TenantScopeInterceptor)
export class PeopleTeamController {
  constructor(
    private readonly leave: LeaveService,
    private readonly availability: AvailabilityService,
    private readonly attendanceDay: AttendanceDayService,
  ) {}

  @Get('availability')
  @RequirePermission('people.team.availability.read')
  availabilityFor(@Identity() id: RequestIdentity, @Query('orgUnitId') orgUnitId: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.availability.team(tenant(id), user(id), orgUnitId, from, to);
  }

  @Get('leave-requests')
  @RequirePermission('people.team.leave.approve')
  leaveRequests(
    @Identity() id: RequestIdentity,
    @Query('orgUnitId') orgUnitId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.leave.listTeam(tenant(id), user(id), { orgUnitId, status, from, to });
  }

  @Get('attendance')
  @RequirePermission('people.team.availability.read')
  attendance(@Identity() id: RequestIdentity, @Query('orgUnitId') orgUnitId: string, @Query('from') from: string, @Query('to') to: string) {
    return this.attendanceDay.team(tenant(id), user(id), orgUnitId, new Date(from), new Date(to));
  }
}

@Controller('api/people/overtime-requests')
@UseInterceptors(TenantScopeInterceptor)
export class OvertimeRequestsController {
  constructor(private readonly svc: OvertimeService) {}

  @Get()
  @RequirePermission('people.self.attendance.correct')
  listMine(@Identity() id: RequestIdentity) {
    return this.svc.listMine(tenant(id), user(id));
  }

  @Post()
  @RequirePermission('people.self.attendance.correct')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(tenant(id), user(id), body ?? {});
  }

  @Post(':id/approve')
  @RequirePermission('people.team.attendance.approve')
  approve(@Param('id') oid: string, @Identity() id: RequestIdentity) {
    return this.svc.approve(tenant(id), user(id), oid);
  }

  @Post(':id/reject')
  @RequirePermission('people.team.attendance.approve')
  reject(@Param('id') oid: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.reject(tenant(id), user(id), oid, body ?? {});
  }
}

// ---- PE-02 — Attendance & Correction ---------------------------------------

@Controller('api/people/work-calendars')
@UseInterceptors(TenantScopeInterceptor)
export class WorkCalendarController {
  constructor(private readonly svc: WorkCalendarService) {}

  @Get()
  @RequirePermission('people.hr.timekeeping.manage')
  list(@Identity() id: RequestIdentity) {
    return this.svc.list(tenant(id));
  }

  @Post()
  @RequirePermission('people.hr.timekeeping.manage')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(tenant(id), user(id), body ?? {});
  }
}

@Controller('api/people/shift-patterns')
@UseInterceptors(TenantScopeInterceptor)
export class ShiftPatternsController {
  constructor(private readonly svc: ShiftService) {}

  @Get()
  @RequirePermission('people.hr.timekeeping.manage')
  list(@Identity() id: RequestIdentity) {
    return this.svc.listPatterns(tenant(id));
  }

  @Post()
  @RequirePermission('people.hr.timekeeping.manage')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.createPattern(tenant(id), user(id), body ?? {});
  }
}

@Controller('api/people/shift-assignments')
@UseInterceptors(TenantScopeInterceptor)
export class ShiftAssignmentsController {
  constructor(private readonly svc: ShiftService) {}

  @Get()
  @RequirePermission('people.hr.timekeeping.manage')
  list(@Identity() id: RequestIdentity, @Query('personId') personId?: string) {
    return this.svc.listAssignments(tenant(id), personId);
  }

  @Post()
  @RequirePermission('people.hr.timekeeping.manage')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.createAssignment(tenant(id), user(id), body ?? {});
  }
}

@Controller('api/people/imports')
@UseInterceptors(TenantScopeInterceptor)
export class AttendanceImportsController {
  constructor(private readonly svc: AttendanceImportService) {}

  @Get()
  @RequirePermission('people.hr.import.manage')
  list(@Identity() id: RequestIdentity) {
    return this.svc.list(tenant(id));
  }

  /** Parses + validates only — does NOT write AttendanceEvent (preview step). */
  @Post()
  @RequirePermission('people.hr.import.manage')
  preview(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.preview(tenant(id), user(id), body ?? {});
  }

  @Post(':id/commit')
  @RequirePermission('people.hr.import.manage')
  commit(@Param('id') bid: string, @Identity() id: RequestIdentity) {
    return this.svc.commit(tenant(id), user(id), bid);
  }

  @Post(':id/rollback')
  @RequirePermission('people.hr.import.manage')
  rollback(@Param('id') bid: string, @Identity() id: RequestIdentity) {
    return this.svc.rollback(tenant(id), user(id), bid);
  }
}

@Controller('api/people/attendance')
@UseInterceptors(TenantScopeInterceptor)
export class AttendanceController {
  constructor(
    private readonly svc: AttendanceDayService,
    private readonly identity: IdentityService,
  ) {}

  @Get('me')
  @RequirePermission('people.self.attendance.read')
  async me(@Identity() id: RequestIdentity, @Query('from') from: string, @Query('to') to: string) {
    const person = await resolveActingPerson(this.identity, user(id));
    return this.svc.me(tenant(id), person.id, new Date(from), new Date(to));
  }
}

@Controller('api/people/attendance-corrections')
@UseInterceptors(TenantScopeInterceptor)
export class AttendanceCorrectionsController {
  constructor(private readonly svc: AttendanceCorrectionService) {}

  @Get()
  @RequirePermission('people.self.attendance.correct')
  listMine(@Identity() id: RequestIdentity) {
    return this.svc.listMine(tenant(id), user(id));
  }

  @Post()
  @RequirePermission('people.self.attendance.correct')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(tenant(id), user(id), body ?? {});
  }

  @Post(':id/approve')
  @RequirePermission('people.team.attendance.approve')
  approve(@Param('id') cid: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.approve(tenant(id), user(id), cid, body ?? {});
  }

  @Post(':id/reject')
  @RequirePermission('people.team.attendance.approve')
  reject(@Param('id') cid: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.reject(tenant(id), user(id), cid, body ?? {});
  }
}
