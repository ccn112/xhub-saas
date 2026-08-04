import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';
import { LEAVE_POLICY_CODES } from './people.constants';

@Injectable()
export class LeavePolicyService {
  constructor(private readonly prisma: XofficePrismaService) {}
  private get db() {
    return this.prisma.db;
  }

  async list(tenantId: string, filter: { status?: string } = {}) {
    const items = await this.db.leavePolicyRef.findMany({
      where: { tenantId, ...(filter.status ? { status: filter.status } : {}) },
      orderBy: [{ code: 'asc' }],
    });
    return { items, count: items.length };
  }

  async get(tenantId: string, id: string) {
    const policy = await this.db.leavePolicyRef.findFirst({ where: { id, tenantId } });
    if (!policy) throw new NotFoundException(`leave policy not found: ${id}`);
    return policy;
  }

  async create(tenantId: string, actorId: string, body: any) {
    const code = String(body?.code ?? '').toUpperCase();
    if (!LEAVE_POLICY_CODES.includes(code as any)) {
      throw new BadRequestException(`invalid code ${code} (one of ${LEAVE_POLICY_CODES.join('/')})`);
    }
    if (!body?.name) throw new BadRequestException('name is required');
    return this.db.leavePolicyRef.create({
      data: {
        tenantId,
        code,
        name: body.name,
        paid: body.paid ?? true,
        unit: body.unit ?? 'DAY',
        accrualMethod: body.accrualMethod ?? 'ANNUAL',
        accrualPerPeriod: body.accrualPerPeriod ?? 0,
        maxCarryOver: body.maxCarryOver ?? null,
        allowNegative: body.allowNegative ?? false,
        requiresAttachment: body.requiresAttachment ?? false,
        minNoticeDays: body.minNoticeDays ?? 0,
        maxConsecutiveDays: body.maxConsecutiveDays ?? null,
        appliesToOrgUnitIds: body.appliesToOrgUnitIds ?? [],
        appliesToPositionIds: body.appliesToPositionIds ?? [],
        createdBy: actorId,
      },
    });
  }
}
