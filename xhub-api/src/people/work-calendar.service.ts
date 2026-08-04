import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';

@Injectable()
export class WorkCalendarService {
  constructor(private readonly prisma: XofficePrismaService) {}
  private get db() {
    return this.prisma.db;
  }

  async list(tenantId: string) {
    const items = await this.db.workCalendar.findMany({ where: { tenantId }, orderBy: [{ code: 'asc' }] });
    return { items, count: items.length };
  }

  async get(tenantId: string, id: string) {
    const cal = await this.db.workCalendar.findFirst({ where: { id, tenantId } });
    if (!cal) throw new NotFoundException(`work calendar not found: ${id}`);
    return cal;
  }

  async create(tenantId: string, actorId: string, body: any) {
    if (!body?.code) throw new BadRequestException('code is required');
    if (!body?.name) throw new BadRequestException('name is required');
    return this.db.workCalendar.create({
      data: {
        tenantId,
        code: body.code,
        name: body.name,
        workingWeekdays: body.workingWeekdays ?? [1, 2, 3, 4, 5],
        holidays: body.holidays ?? [],
        createdBy: actorId,
      },
    });
  }
}
