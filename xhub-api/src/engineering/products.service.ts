import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateProductInput {
  code: string;
  name: string;
  type?: string;
  ownerRole?: string;
  versionPolicy?: string;
  description?: string;
  rolloutOrder?: number;
  actorId?: string;
}

const VALID_TYPES = ['PLATFORM', 'SAAS_PRODUCT', 'DOMAIN_PRODUCT'];
const VALID_VERSION_POLICIES = ['SEMVER', 'CALVER', 'CUSTOM'];

/**
 * Product Registry (DG-01, docs/implementation/engineering-hub). Platform-
 * wide, not tenant-scoped — reads/writes the shared Product/ProductComponent/
 * RepositoryConnection/Environment tables exclusively via `prisma.withBypass`,
 * mirroring TenantRegistryService (src/platform/tenant-registry.service.ts).
 * No TenantScopeInterceptor is used anywhere in this module — see
 * ADR_SCOPE_MODEL.md for why these tables carry no RLS.
 */
@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.withBypass(() =>
      this.prisma.db.product.findMany({
        orderBy: [{ rolloutOrder: 'asc' }, { name: 'asc' }],
        include: { versions: { orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
    );
  }

  async get(idOrCode: string) {
    const product = await this.prisma.withBypass(() =>
      this.prisma.db.product.findFirst({
        where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
        include: {
          components: { include: { repositories: true } },
          environments: true,
          versions: { orderBy: { createdAt: 'desc' } },
          releaseTrains: true,
        },
      }),
    );
    if (!product) throw new NotFoundException(`Unknown product: ${idOrCode}`);
    return product;
  }

  async create(input: CreateProductInput) {
    const code = (input.code || '').trim();
    if (!code) throw new BadRequestException('code is required');
    if (!input.name?.trim()) throw new BadRequestException('name is required');
    const type = input.type ?? 'SAAS_PRODUCT';
    if (!VALID_TYPES.includes(type)) {
      throw new BadRequestException(`type must be one of ${VALID_TYPES.join(', ')}`);
    }
    const versionPolicy = input.versionPolicy ?? 'SEMVER';
    if (!VALID_VERSION_POLICIES.includes(versionPolicy)) {
      throw new BadRequestException(`versionPolicy must be one of ${VALID_VERSION_POLICIES.join(', ')}`);
    }
    const existing = await this.prisma.withBypass(() =>
      this.prisma.db.product.findUnique({ where: { code } }),
    );
    if (existing) throw new BadRequestException(`Product code already exists: ${code}`);
    return this.prisma.withBypass(() =>
      this.prisma.db.product.create({
        data: {
          code,
          name: input.name,
          type,
          ownerRole: input.ownerRole,
          versionPolicy,
          description: input.description,
          rolloutOrder: input.rolloutOrder,
          createdBy: input.actorId,
          updatedBy: input.actorId,
        },
      }),
    );
  }
}
