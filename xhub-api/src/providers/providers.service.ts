import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Provider/Catalog reads (Wave A). Global, non-RLS tables — same posture as
 * ProjectCatalogService (see that file's docblock). Never selects
 * PlaceSource.sourcePayload / ProviderContact raw rows into a response.
 */
@Injectable()
export class ProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProvider(id: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { id },
      include: { contacts: true, locations: true },
    });
    if (!provider) throw new NotFoundException('Provider not found');
    return this.toPublicProvider(provider);
  }

  async getCatalog(id: string) {
    const provider = await this.prisma.provider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Provider not found');
    const items = await this.prisma.catalogItem.findMany({
      where: { providerId: id, status: 'ACTIVE' },
      include: { prices: { orderBy: { observedAt: 'desc' }, take: 1 } },
    });
    return {
      providerId: id,
      items: items.map((item) => ({
        id: item.id,
        itemType: item.itemType,
        name: item.name,
        unit: item.unit,
        image: item.image,
        latestPrice: item.prices[0]
          ? {
              priceVnd: item.prices[0].priceVndInteger,
              currency: item.prices[0].currency,
              observedAt: item.prices[0].observedAt,
              isPromotional: item.prices[0].isPromotional,
            }
          : null,
      })),
    };
  }

  private toPublicProvider(p: {
    id: string;
    displayName: string;
    providerType: string | null;
    verificationStatus: string;
    partnerStatus: string;
    website: string | null;
    phone: string | null;
    email: string | null;
    description: string | null;
    contacts: { type: string; value: string; isPrimary: boolean }[];
    locations: {
      id: string;
      locationName: string | null;
      address: string | null;
      isPrimary: boolean;
    }[];
  }) {
    return {
      id: p.id,
      name: p.displayName,
      type: p.providerType,
      verificationStatus: p.verificationStatus,
      partnerStatus: p.partnerStatus,
      website: p.website,
      phone: p.phone,
      email: p.email,
      description: p.description,
      contacts: p.contacts.map((c) => ({
        type: c.type,
        value: c.value,
        isPrimary: c.isPrimary,
      })),
      locations: p.locations.map((l) => ({
        id: l.id,
        name: l.locationName,
        address: l.address,
        isPrimary: l.isPrimary,
      })),
    };
  }
}
