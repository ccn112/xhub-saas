import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Shared PostGIS nearby query, used by ProjectCatalogService (project-anchored
 * nearby/providers) and DiscoveryService (raw lat/lng nearby + search). First
 * raw-SQL usage in this repo — see docs/geo-migration/XHUB_GEO_READINESS_AUDIT.md
 * §9 for why (no Prisma-native geography/ST_DWithin support). Built with
 * Prisma.sql/Prisma.join so every interpolated value is still parameterized
 * (NOT string concatenation) — safe against injection despite being raw SQL.
 *
 * Returns joined Place + primary ProviderLocation's Provider, zoned/ranked by
 * distance only for Wave A (doc §9.3's confidence/freshness/partner-boost
 * ranking is a fast-follow, not required for the golden-slice smoke test).
 * Never selects PlaceSource.sourcePayload / ProviderContact raw rows — no
 * raw source payload reaches the API response (doc §11).
 */
export interface NearbyFilters {
  lat: number;
  lng: number;
  radiusM: number;
  category?: string;
  verifiedOnly?: boolean;
  partnerOnly?: boolean;
  q?: string;
  page: number;
  limit: number;
}

export interface NearbyRow {
  placeId: string;
  providerId: string | null;
  name: string;
  categoryCode: string | null;
  distanceM: number;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  verificationStatus: string | null;
  partnerStatus: string | null;
  lastObservedAt: Date | null;
  dataConfidence: number | null;
}

export function zoneForDistance(distanceM: number): string {
  if (distanceM <= 0) return 'inside';
  if (distanceM <= 300) return 'gate';
  if (distanceM <= 800) return 'walkable';
  if (distanceM <= 2000) return 'nearby';
  return 'extended';
}

export async function queryNearbyPlaces(
  prisma: PrismaService,
  filters: NearbyFilters,
): Promise<NearbyRow[]> {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`p.geom IS NOT NULL`,
    Prisma.sql`ST_DWithin(p.geom, ST_SetSRID(ST_MakePoint(${filters.lng}, ${filters.lat}), 4326)::geography, ${filters.radiusM})`,
  ];
  if (filters.category) {
    conditions.push(Prisma.sql`p."primaryCategoryId" = ${filters.category}`);
  }
  if (filters.verifiedOnly) {
    conditions.push(
      Prisma.sql`pv."verificationStatus" IN ('VERIFIED','CLAIMED','PARTNER')`,
    );
  }
  if (filters.partnerOnly) {
    conditions.push(Prisma.sql`pv."partnerStatus" != 'NONE'`);
  }
  if (filters.q) {
    conditions.push(Prisma.sql`p."normalizedName" ILIKE ${`%${filters.q}%`}`);
  }
  const offset = (filters.page - 1) * filters.limit;

  return prisma.$queryRaw<NearbyRow[]>`
    SELECT p.id AS "placeId", pv.id AS "providerId",
           COALESCE(pv."displayName", p."canonicalName") AS name,
           p."primaryCategoryId" AS "categoryCode",
           ST_Distance(p.geom, ST_SetSRID(ST_MakePoint(${filters.lng}, ${filters.lat}), 4326)::geography) AS "distanceM",
           p."addressText" AS address,
           COALESCE(pv.phone, p."phonePrimary") AS phone,
           pv.email AS email,
           COALESCE(pv.website, p."websitePrimary") AS website,
           pv."verificationStatus" AS "verificationStatus",
           pv."partnerStatus" AS "partnerStatus",
           p."lastObservedAt" AS "lastObservedAt",
           p."dataConfidence" AS "dataConfidence"
    FROM "Place" p
    LEFT JOIN "ProviderLocation" pl ON pl."placeId" = p.id AND pl."isPrimary" = true
    LEFT JOIN "Provider" pv ON pv.id = pl."providerId"
    WHERE ${Prisma.join(conditions, ' AND ')}
    ORDER BY "distanceM" ASC
    LIMIT ${filters.limit} OFFSET ${offset}
  `;
}
