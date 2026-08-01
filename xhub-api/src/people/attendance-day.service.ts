import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { ShiftService } from './shift.service';

function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * AttendanceDay — MATERIALIZED read model, computed ONLY by recomputeDay()
 * (from AttendanceEvent + ShiftAssignment/ShiftPattern + approved LeaveRequest
 * + WorkCalendar) or overwritten by an approved AttendanceCorrectionRequest.
 * recomputeDay is a no-op on a day already marked `correctionApplied` — a
 * human correction is authoritative until a NEW correction supersedes it.
 */
@Injectable()
export class AttendanceDayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
    private readonly shift: ShiftService,
  ) {}
  private get db() {
    return this.prisma.db;
  }

  async recomputeDay(tenantId: string, personId: string, workDate: Date) {
    const day = dateOnly(workDate);
    const dayEnd = new Date(day.getTime() + 24 * 60 * 60 * 1000);

    const existing = await this.db.attendanceDay.findUnique({
      where: { tenantId_personId_workDate: { tenantId, personId, workDate: day } },
    });
    if (existing?.correctionApplied) return existing;

    const events = await this.db.attendanceEvent.findMany({
      where: { tenantId, personId, at: { gte: day, lt: dayEnd } },
      orderBy: { at: 'asc' },
    });
    const firstIn = events.find((e: any) => e.eventType === 'CLOCK_IN')?.at ?? null;
    const lastOutEvents = events.filter((e: any) => e.eventType === 'CLOCK_OUT');
    const lastOut = lastOutEvents.length ? lastOutEvents[lastOutEvents.length - 1].at : null;

    const leave = await this.db.leaveRequest.findFirst({
      where: { tenantId, personId, status: 'APPROVED', startAt: { lte: dayEnd }, endAt: { gte: day } },
    });

    const assignment = await this.shift.effectiveFor(tenantId, personId, day);
    const pattern = assignment ? await this.db.shiftPattern.findUnique({ where: { id: assignment.shiftPatternId } }) : null;
    const calendar = assignment ? await this.db.workCalendar.findUnique({ where: { id: assignment.workCalendarId } }) : null;

    const isoDate = day.toISOString().slice(0, 10);
    const weekday = day.getUTCDay() === 0 ? 7 : day.getUTCDay(); // 1=Mon..7=Sun
    const isHoliday = (calendar?.holidays as any[] | undefined)?.some((h) => h?.date === isoDate) ?? false;
    const isWorkingDay = calendar ? calendar.workingWeekdays.includes(weekday) : true;

    let status: string;
    let workedMinutes = 0;
    let lateMinutes = 0;

    if (leave) {
      status = 'LEAVE';
    } else if (isHoliday) {
      status = 'HOLIDAY';
    } else if (!isWorkingDay) {
      status = 'WEEKEND';
    } else if (!firstIn) {
      status = 'ABSENT';
    } else {
      workedMinutes = lastOut ? Math.round((lastOut.getTime() - firstIn.getTime()) / 60000) : 0;
      status = 'PRESENT';
      if (pattern) {
        const [sh, sm] = pattern.startTime.split(':').map(Number);
        const shiftStart = new Date(day);
        shiftStart.setUTCHours(sh, sm, 0, 0);
        const graceEnd = new Date(shiftStart.getTime() + pattern.graceMinutes * 60000);
        if (firstIn > graceEnd) {
          lateMinutes = Math.round((firstIn.getTime() - shiftStart.getTime()) / 60000);
          status = 'LATE';
        }
        if (lastOut && workedMinutes < (pattern.standardHours * 60) / 2) status = 'HALF_DAY';
      }
    }

    return this.db.attendanceDay.upsert({
      where: { tenantId_personId_workDate: { tenantId, personId, workDate: day } },
      create: {
        tenantId,
        personId,
        workDate: day,
        shiftPatternId: pattern?.id ?? null,
        firstIn,
        lastOut,
        workedMinutes,
        lateMinutes,
        status,
        sourceEventIds: events.map((e: any) => e.id),
      },
      update: {
        shiftPatternId: pattern?.id ?? null,
        firstIn,
        lastOut,
        workedMinutes,
        lateMinutes,
        status,
        sourceEventIds: events.map((e: any) => e.id),
        recomputedAt: new Date(),
      },
    });
  }

  async me(tenantId: string, personId: string, from: Date, to: Date) {
    const items = await this.db.attendanceDay.findMany({
      where: { tenantId, personId, workDate: { gte: dateOnly(from), lte: dateOnly(to) } },
      orderBy: { workDate: 'asc' },
    });
    return { items, count: items.length };
  }

  async team(tenantId: string, userId: string, orgUnitId: string, from: Date, to: Date) {
    const eff = await this.identity.effectivePermissions(userId);
    const scopedOrgUnits = [...new Set(eff.scopes.flatMap((s: any) => s?.orgUnits ?? []))];
    if (scopedOrgUnits.length && !scopedOrgUnits.includes(orgUnitId)) {
      throw new ForbiddenException({ code: 'OUT_OF_SCOPE', message: 'orgUnitId is outside caller scope' });
    }
    const positions = await this.db.position.findMany({ where: { tenantId, orgUnitId } });
    const personIds = positions.map((p: any) => p.holderPersonId).filter((id: any): id is string => !!id);
    const items = personIds.length
      ? await this.db.attendanceDay.findMany({
          where: { tenantId, personId: { in: personIds }, workDate: { gte: dateOnly(from), lte: dateOnly(to) } },
          orderBy: [{ personId: 'asc' }, { workDate: 'asc' }],
        })
      : [];
    return { items, count: items.length };
  }
}
