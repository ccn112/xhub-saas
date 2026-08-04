import { BadRequestException, Injectable } from '@nestjs/common';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';
import { ATTENDANCE_MODES, LEAVE_MODES, PAYROLL_MODES } from './people.constants';

/**
 * PeopleTenantConfig — singleton per tenant (PE-001 operating-mode switch).
 * SME Lite default (leaveMode=XOFFICE, attendanceMode=FILE_IMPORT,
 * payrollMode=FILE_IMPORT) is created lazily on first read so every tenant has
 * a row without a separate seed step blocking PE-01.
 */
@Injectable()
export class PeopleConfigService {
  constructor(private readonly prisma: XofficePrismaService) {}
  private get db() {
    return this.prisma.db;
  }

  async get(tenantId: string, actorId: string) {
    const existing = await this.db.peopleTenantConfig.findUnique({ where: { tenantId } });
    if (existing) return existing;
    return this.db.peopleTenantConfig.create({
      data: { tenantId, createdBy: actorId },
    });
  }

  async update(tenantId: string, actorId: string, body: any) {
    const current = await this.get(tenantId, actorId);
    const attendanceMode = body.attendanceMode ? String(body.attendanceMode).toUpperCase() : current.attendanceMode;
    const leaveMode = body.leaveMode ? String(body.leaveMode).toUpperCase() : current.leaveMode;
    const payrollMode = body.payrollMode ? String(body.payrollMode).toUpperCase() : current.payrollMode;
    if (!ATTENDANCE_MODES.includes(attendanceMode as any)) {
      throw new BadRequestException({ code: 'INVALID_MODE', message: `invalid attendanceMode ${attendanceMode}` });
    }
    if (!LEAVE_MODES.includes(leaveMode as any)) {
      throw new BadRequestException({ code: 'INVALID_MODE', message: `invalid leaveMode ${leaveMode}` });
    }
    if (!PAYROLL_MODES.includes(payrollMode as any)) {
      throw new BadRequestException({ code: 'INVALID_MODE', message: `invalid payrollMode ${payrollMode}` });
    }
    return this.db.peopleTenantConfig.update({
      where: { tenantId },
      data: {
        attendanceMode,
        leaveMode,
        payrollMode,
        timesheetEnabled: body.timesheetEnabled ?? undefined,
        performanceBridgeEnabled: body.performanceBridgeEnabled ?? undefined,
        iocCapacityEnabled: body.iocCapacityEnabled ?? undefined,
        workCalendarId: body.workCalendarId ?? undefined,
        externalSystemId: body.externalSystemId ?? undefined,
        defaultStandardHoursPerDay: body.defaultStandardHoursPerDay ?? undefined,
        workingWeekdays: body.workingWeekdays ?? undefined,
      },
    });
  }
}
