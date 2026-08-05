import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';

const COMMERCIAL_TYPES = ['PRODUCT', 'SERVICE', 'SUBSCRIPTION', 'IMPLEMENTATION', 'SUPPORT', 'TRAINING'];
const PRICE_MODELS = ['ONE_TIME', 'RECURRING', 'USAGE', 'TIME_MATERIAL', 'MILESTONE'];

/**
 * CommercialCatalogService — commercial product/service catalog (Phase 2,
 * BO-0203). Tenant-scoped (RLS). `version` bumps on every edit (matches
 * EngineeringDocument's pattern) — a Proposal/ContractLine referencing an
 * item keeps the version it was created with implicitly via lineTotal/
 * lineValue snapshots, not a live join, so bumping the catalog item never
 * silently changes historical proposals/contracts.
 */
@Injectable()
export class CommercialCatalogService {
  constructor(private readonly prisma: XofficePrismaService) {}

  private get db() {
    return this.prisma.db;
  }

  list(tenantId: string, filters: { active?: boolean; commercialType?: string } = {}) {
    return this.db.commercialCatalogItem.findMany({
      where: {
        tenantId,
        ...(filters.active !== undefined ? { active: filters.active } : {}),
        ...(filters.commercialType ? { commercialType: filters.commercialType.toUpperCase() } : {}),
      },
      orderBy: { code: 'asc' },
    });
  }

  async get(tenantId: string, idOrCode: string) {
    const item = await this.db.commercialCatalogItem.findFirst({ where: { tenantId, OR: [{ id: idOrCode }, { code: idOrCode }] } });
    if (!item) throw new NotFoundException(`catalog item not found: ${idOrCode}`);
    return item;
  }

  async create(
    tenantId: string,
    actorId: string,
    body: { code: string; name: string; commercialType: string; xhubAppCatalogRef?: string; priceModel?: string },
  ) {
    if (!body?.code?.trim()) throw new BadRequestException('code is required');
    if (!body?.name?.trim()) throw new BadRequestException('name is required');
    const commercialType = body.commercialType?.toUpperCase();
    if (!COMMERCIAL_TYPES.includes(commercialType)) throw new BadRequestException(`commercialType must be one of ${COMMERCIAL_TYPES.join(', ')}`);
    if (body.priceModel && !PRICE_MODELS.includes(body.priceModel.toUpperCase())) {
      throw new BadRequestException(`priceModel must be one of ${PRICE_MODELS.join(', ')}`);
    }
    const existing = await this.db.commercialCatalogItem.findUnique({ where: { tenantId_code: { tenantId, code: body.code } } });
    if (existing) throw new BadRequestException(`Catalog item code already exists: ${body.code}`);
    return this.db.commercialCatalogItem.create({
      data: {
        tenantId,
        code: body.code.trim(),
        name: body.name.trim(),
        commercialType,
        xhubAppCatalogRef: body.xhubAppCatalogRef,
        priceModel: body.priceModel?.toUpperCase(),
        createdBy: actorId,
      },
    });
  }

  async update(tenantId: string, actorId: string, id: string, body: { name?: string; priceModel?: string; active?: boolean }) {
    const item = await this.db.commercialCatalogItem.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException(`catalog item not found: ${id}`);
    if (body.priceModel && !PRICE_MODELS.includes(body.priceModel.toUpperCase())) {
      throw new BadRequestException(`priceModel must be one of ${PRICE_MODELS.join(', ')}`);
    }
    return this.db.commercialCatalogItem.update({
      where: { id },
      data: {
        name: body.name?.trim(),
        priceModel: body.priceModel?.toUpperCase(),
        active: body.active,
        version: { increment: 1 },
      },
    });
  }
}
