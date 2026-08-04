import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';

/** Portfolio — a named grouping of Initiatives for cockpit rollup (MG-04). */
@Injectable()
export class PortfoliosService {
  constructor(private readonly prisma: XofficePrismaService) {}
  private get db() {
    return this.prisma.db;
  }

  private async audit(tenantId: string, code: string, action: string, actorId: string) {
    await this.db.auditLog.create({
      data: { tenantId, instanceCode: code, actorId, action: `manage.portfolio.${action}`, detail: '', at: new Date() },
    });
  }

  private async rollup(tenantId: string, portfolio: any) {
    const initiatives = portfolio.itemIds.length
      ? await this.db.initiative.findMany({ where: { tenantId, id: { in: portfolio.itemIds } } })
      : [];
    const byStage: Record<string, number> = {};
    for (const i of initiatives as any[]) byStage[i.status] = (byStage[i.status] ?? 0) + 1;
    const benefits = initiatives.length
      ? await this.db.benefitProfile.findMany({ where: { tenantId, initiativeId: { in: initiatives.map((i: any) => i.id) } } })
      : [];
    const byBenefitStatus: Record<string, number> = {};
    for (const b of benefits as any[]) byBenefitStatus[b.status] = (byBenefitStatus[b.status] ?? 0) + 1;
    return { initiativeCount: initiatives.length, byStage, benefitCount: benefits.length, byBenefitStatus };
  }

  async list(tenantId: string) {
    const items = await this.db.portfolio.findMany({ where: { tenantId }, orderBy: [{ code: 'asc' }] });
    const decorated = await Promise.all(items.map(async (p: any) => ({ ...p, rollup: await this.rollup(tenantId, p) })));
    return { items: decorated, count: decorated.length };
  }

  async get(tenantId: string, id: string) {
    const portfolio = await this.db.portfolio.findFirst({ where: { id, tenantId } });
    if (!portfolio) throw new NotFoundException(`portfolio not found: ${id}`);
    return { ...portfolio, rollup: await this.rollup(tenantId, portfolio) };
  }

  async create(tenantId: string, actorId: string, body: any) {
    if (!body?.code) throw new BadRequestException('code is required');
    if (!body?.name) throw new BadRequestException('name is required');
    const portfolio = await this.db.portfolio.create({
      data: {
        tenantId,
        code: body.code,
        name: body.name,
        ownerRole: body.ownerRole ?? null,
        strategicThemeId: body.strategicThemeId ?? null,
        itemIds: body.itemIds ?? [],
        createdBy: actorId,
      },
    });
    await this.audit(tenantId, portfolio.code, 'create', actorId);
    return { ...portfolio, rollup: await this.rollup(tenantId, portfolio) };
  }

  async update(tenantId: string, actorId: string, id: string, body: any) {
    const existing = await this.db.portfolio.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException(`portfolio not found: ${id}`);
    if (body?.itemIds) {
      const found = await this.db.initiative.findMany({ where: { tenantId, id: { in: body.itemIds } } });
      if (found.length !== body.itemIds.length) {
        throw new BadRequestException('itemIds must all reference existing Initiative rows');
      }
    }
    const updated = await this.db.portfolio.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        ownerRole: body.ownerRole ?? undefined,
        strategicThemeId: body.strategicThemeId ?? undefined,
        itemIds: body.itemIds ?? undefined,
      },
    });
    await this.audit(tenantId, updated.code, 'update', actorId);
    return { ...updated, rollup: await this.rollup(tenantId, updated) };
  }
}
