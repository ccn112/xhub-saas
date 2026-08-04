import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';

/** ShiftPattern (definitions) + ShiftAssignment (person → pattern + calendar over a window). */
@Injectable()
export class ShiftService {
  constructor(private readonly prisma: XofficePrismaService) {}
  private get db() {
    return this.prisma.db;
  }

  async listPatterns(tenantId: string) {
    const items = await this.db.shiftPattern.findMany({ where: { tenantId }, orderBy: [{ code: 'asc' }] });
    return { items, count: items.length };
  }

  async createPattern(tenantId: string, actorId: string, body: any) {
    if (!body?.code) throw new BadRequestException('code is required');
    if (!body?.name) throw new BadRequestException('name is required');
    if (!body?.startTime || !body?.endTime) throw new BadRequestException('startTime/endTime are required (e.g. "08:30")');
    return this.db.shiftPattern.create({
      data: {
        tenantId,
        code: body.code,
        name: body.name,
        startTime: body.startTime,
        endTime: body.endTime,
        breakMinutes: body.breakMinutes ?? 60,
        graceMinutes: body.graceMinutes ?? 15,
        standardHours: body.standardHours ?? 8,
        createdBy: actorId,
      },
    });
  }

  async listAssignments(tenantId: string, personId?: string) {
    const items = await this.db.shiftAssignment.findMany({
      where: { tenantId, ...(personId ? { personId } : {}) },
      orderBy: [{ effectiveFrom: 'desc' }],
    });
    return { items, count: items.length };
  }

  async createAssignment(tenantId: string, actorId: string, body: any) {
    if (!body?.personId) throw new BadRequestException('personId is required');
    const pattern = await this.db.shiftPattern.findFirst({ where: { id: body?.shiftPatternId, tenantId } });
    if (!pattern) throw new NotFoundException(`shift pattern not found: ${body?.shiftPatternId}`);
    const calendar = await this.db.workCalendar.findFirst({ where: { id: body?.workCalendarId, tenantId } });
    if (!calendar) throw new NotFoundException(`work calendar not found: ${body?.workCalendarId}`);
    if (!body?.effectiveFrom) throw new BadRequestException('effectiveFrom is required');
    return this.db.shiftAssignment.create({
      data: {
        tenantId,
        personId: body.personId,
        shiftPatternId: pattern.id,
        workCalendarId: calendar.id,
        effectiveFrom: new Date(body.effectiveFrom),
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
        createdBy: actorId,
      },
    });
  }

  /** Effective assignment for a person on a given date (latest row whose window covers it). */
  async effectiveFor(tenantId: string, personId: string, at: Date) {
    return this.db.shiftAssignment.findFirst({
      where: {
        tenantId,
        personId,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }
}
