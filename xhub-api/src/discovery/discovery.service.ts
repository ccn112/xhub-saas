import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  queryNearbyPlaces,
  zoneForDistance,
  type NearbyRow,
} from './nearby-query.util';

/**
 * Raw lat/lng discovery (Wave A) — doc §11 `GET /api/discovery/nearby` and
 * `GET /api/discovery/search`. Same underlying query as
 * ProjectCatalogService.getNearby, just not anchored to a GlobalProject.
 */
@Injectable()
export class DiscoveryService {
  constructor(private readonly prisma: PrismaService) {}

  async nearby(params: {
    lat?: number;
    lng?: number;
    radiusM?: number;
    category?: string;
    page?: number;
    limit?: number;
  }) {
    if (params.lat == null || params.lng == null) {
      throw new BadRequestException('lat and lng are required');
    }
    const radiusM = Math.min(5000, Math.max(100, params.radiusM ?? 3000));
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));

    const rows = await queryNearbyPlaces(this.prisma, {
      lat: params.lat,
      lng: params.lng,
      radiusM,
      category: params.category,
      page,
      limit,
    });

    return {
      lat: params.lat,
      lng: params.lng,
      radiusM,
      generatedAt: new Date().toISOString(),
      items: rows.map((r) => this.toItem(r)),
    };
  }

  async search(params: { q?: string; page?: number; limit?: number }) {
    const q = (params.q ?? '').trim();
    if (!q) return { items: [] };
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    // Text-only search has no anchor point — search by name only (no distance
    // sort), a plain ILIKE over Place.normalizedName. Good enough for Wave A;
    // a real full-text/trigram index is a fast-follow once volume grows past
    // the single-AOI pilot.
    const places = await this.prisma.place.findMany({
      where: { normalizedName: { contains: q.toLowerCase() } },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      items: places.map((p) => ({
        placeId: p.id,
        name: p.canonicalName,
        category: p.primaryCategoryId ? { code: p.primaryCategoryId } : null,
        address: p.addressText,
      })),
    };
  }

  private toItem(r: NearbyRow) {
    const distanceM = Math.round(Number(r.distanceM));
    return {
      placeId: r.placeId,
      providerId: r.providerId,
      name: r.name,
      category: r.categoryCode ? { code: r.categoryCode } : null,
      distanceM,
      zone: zoneForDistance(distanceM),
      address: r.address,
      contacts: {
        phone: r.phone,
        email: r.email,
        website: r.website,
        facebook: null,
      },
      verificationStatus: r.verificationStatus ?? 'DISCOVERED',
      partnerStatus: r.partnerStatus ?? 'NONE',
    };
  }
}
