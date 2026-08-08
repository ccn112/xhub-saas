import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * DATA-03 (Wave A) Equipment/Product Master reads. Global, non-RLS tables
 * (see prisma/schema.prisma's DATA-03 block comment) — same posture as
 * ProjectCatalogService/OrganizationsService: no TenantScopeInterceptor,
 * no @RequirePermission (platform-internal MDM read).
 */
@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    page?: number;
    limit?: number;
    q?: string;
    categoryCode?: string;
    manufacturerOrgId?: string;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const where: Record<string, unknown> = {};
    if (params.categoryCode) where.categoryCode = params.categoryCode;
    if (params.manufacturerOrgId)
      where.manufacturerOrgId = params.manufacturerOrgId;
    if (params.q) {
      where.OR = [
        { familyName: { contains: params.q, mode: 'insensitive' } },
        { modelCode: { contains: params.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.equipmentProduct.findMany({
        where,
        include: {
          manufacturer: {
            select: { id: true, legalName: true, shortName: true },
          },
        },
        orderBy: { familyName: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.equipmentProduct.count({ where }),
    ]);
    return {
      items: items.map((p) => this.toSummary(p)),
      meta: { page, limit, total },
    };
  }

  async getById(id: string) {
    const product = await this.prisma.equipmentProduct.findUnique({
      where: { id },
      include: {
        manufacturer: {
          select: { id: true, legalName: true, shortName: true },
        },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.toSummary(product);
  }

  async getSpecs(id: string) {
    await this.assertExists(id);
    const specs = await this.prisma.productSpec.findMany({
      where: { productId: id },
      orderBy: { specKey: 'asc' },
    });
    return {
      items: specs.map((s) => ({
        key: s.specKey,
        valueText: s.valueText,
        valueNumber: s.valueNumber,
        unit: s.unit,
        observedAt: s.observedAt,
      })),
    };
  }

  async getSuppliers(id: string) {
    await this.assertExists(id);
    // Doc §6: a product's channel isn't just its manufacturer — dealers/
    // installers/maintainers are separate OrganizationProductRelation rows.
    const relations = await this.prisma.organizationProductRelation.findMany({
      where: { productId: id },
      include: {
        organization: {
          select: { id: true, legalName: true, shortName: true },
        },
      },
    });
    return {
      items: relations.map((r) => ({
        organizationId: r.organizationId,
        organizationName: r.organization.legalName,
        relationType: r.relationType,
        authorizationStatus: r.authorizationStatus,
        regionScope: r.regionScope,
      })),
    };
  }

  async getPrices(id: string) {
    await this.assertExists(id);
    // Temporal observations, never a static price column (doc §7's explicit
    // rule) — return the full history, newest first, caller decides "current".
    const observations = await this.prisma.productPriceObservation.findMany({
      where: { productId: id },
      orderBy: { observedAt: 'desc' },
    });
    return {
      items: observations.map((p) => ({
        amount: p.amount,
        currency: p.currency,
        priceScope: p.priceScope,
        vatIncluded: p.vatIncluded,
        installationIncluded: p.installationIncluded,
        sourceUrl: p.sourceUrl,
        sourceVintage: p.sourceVintage,
        observedAt: p.observedAt,
      })),
    };
  }

  private async assertExists(id: string) {
    const exists = await this.prisma.equipmentProduct.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Product not found');
  }

  private toSummary(p: {
    id: string;
    categoryCode: string;
    familyName: string | null;
    modelCode: string | null;
    productType: string | null;
    lifecycleStatus: string;
    officialProductUrl: string | null;
    manufacturer: {
      id: string;
      legalName: string;
      shortName: string | null;
    } | null;
  }) {
    return {
      id: p.id,
      categoryCode: p.categoryCode,
      familyName: p.familyName,
      modelCode: p.modelCode,
      productType: p.productType,
      lifecycleStatus: p.lifecycleStatus,
      officialProductUrl: p.officialProductUrl,
      manufacturer: p.manufacturer
        ? {
            id: p.manufacturer.id,
            name: p.manufacturer.shortName ?? p.manufacturer.legalName,
          }
        : null,
    };
  }
}
