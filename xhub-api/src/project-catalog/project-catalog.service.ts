import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  queryNearbyPlaces,
  zoneForDistance,
  type NearbyRow,
} from '../discovery/nearby-query.util';

/**
 * Global Project Catalog (Wave A / Hapulico golden slice). Reads the
 * NON-tenant GlobalProject/Place/Provider tables directly via the base
 * PrismaService client (no withTenant/withBypass — these tables carry no
 * RLS policy at all, see prisma/schema.prisma's Geo/Provider block comment
 * and scripts/rls-setup.mjs). No @RequirePermission on the controller: this
 * is meant-to-be-public catalog data, same posture as X2's
 * `GET /api/v1/public/projects` (no auth) — see
 * docs/geo-migration/X2_PROJECT_CATALOG_AUDIT.md §4.
 */
@Injectable()
export class ProjectCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async getProject(idOrCode: string) {
    const project = await this.prisma.globalProject.findFirst({
      where: { OR: [{ id: idOrCode }, { code: idOrCode }, { slug: idOrCode }] },
    });
    if (!project) throw new NotFoundException('GlobalProject not found');
    return this.toPublicProject(project);
  }

  async listProjects(params: { page?: number; limit?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const projects = await this.prisma.globalProject.findMany({
      where: { isPublic: true, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      items: projects.map((p) => this.toPublicProject(p)),
      meta: { page, limit },
    };
  }

  async getNearby(
    idOrCode: string,
    params: {
      radiusM?: number;
      category?: string;
      verifiedOnly?: boolean;
      partnerOnly?: boolean;
      sort?: 'distance';
      page?: number;
      limit?: number;
    },
  ) {
    const project = await this.prisma.globalProject.findFirst({
      where: { OR: [{ id: idOrCode }, { code: idOrCode }, { slug: idOrCode }] },
    });
    if (!project) throw new NotFoundException('GlobalProject not found');
    if (project.latitude == null || project.longitude == null) {
      return this.emptyNearby(project.id, params.radiusM ?? 3000);
    }

    const radiusM = Math.min(5000, Math.max(100, params.radiusM ?? 3000));
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));

    const rows = await queryNearbyPlaces(this.prisma, {
      lat: project.latitude,
      lng: project.longitude,
      radiusM,
      category: params.category,
      verifiedOnly: params.verifiedOnly,
      partnerOnly: params.partnerOnly,
      page,
      limit,
    });

    return {
      projectId: project.id,
      radiusM,
      generatedAt: new Date().toISOString(),
      items: rows.map((r) => this.toNearbyItem(r)),
      meta: {
        sourceVersion: '1',
        nextCursor: rows.length === limit ? String(page + 1) : null,
      },
    };
  }

  async getProviders(
    idOrCode: string,
    params: { page?: number; limit?: number },
  ) {
    // Same nearby computation, just presented as a provider list (doc §11
    // `GET /catalog/projects/:id/providers`) — no separate query needed.
    return this.getNearby(idOrCode, { ...params, radiusM: 3000 });
  }

  async getSupplyGraph(idOrCode: string) {
    // DATA-04 (Wave A) — doc §16's X2 projection contract:
    // GET /catalog/projects/:id/supply-graph. ProjectCandidate is the
    // staging layer between the 85 supplied edges and a real GlobalProject
    // (see prisma/schema.prisma's DATA-04 block + docs/data04/) — a
    // candidate only shows up here once matchedGlobalProjectId is set by a
    // (future, Wave C) matcher script, never invented. Checked directly:
    // none of the 81 candidates is Hapulico, so this legitimately returns
    // an empty graph today — that is the correct, disclosed state, not a
    // bug in this endpoint.
    const project = await this.prisma.globalProject.findFirst({
      where: { OR: [{ id: idOrCode }, { code: idOrCode }, { slug: idOrCode }] },
    });
    if (!project) throw new NotFoundException('GlobalProject not found');

    const candidates = await this.prisma.projectCandidate.findMany({
      where: { matchedGlobalProjectId: project.id },
      include: {
        edges: {
          include: {
            organization: {
              select: { id: true, legalName: true, shortName: true },
            },
            product: {
              select: { id: true, familyName: true, modelCode: true },
            },
          },
        },
        gaps: true,
      },
    });

    return {
      projectId: project.id,
      matchedCandidateCount: candidates.length,
      edges: candidates.flatMap((c) =>
        c.edges.map((e) => ({
          candidateCode: c.candidateCode,
          relationshipType: e.relationshipType,
          serviceCategory: e.serviceCategory,
          provider: e.organization
            ? {
                id: e.organization.id,
                name: e.organization.shortName ?? e.organization.legalName,
              }
            : { id: null, name: e.rawProviderName },
          product: e.product
            ? {
                id: e.product.id,
                name: e.product.familyName ?? e.product.modelCode,
              }
            : null,
          relationshipStatus: e.relationshipStatus,
          evidenceUrl: e.evidenceUrl,
          confidence: e.confidence,
        })),
      ),
      gaps: candidates.flatMap((c) =>
        c.gaps.map((g) => ({
          candidateCode: c.candidateCode,
          category: g.category,
          knownFact: g.knownFact,
          status: g.status,
        })),
      ),
      note:
        candidates.length === 0
          ? 'No ProjectCandidate matched to this GlobalProject yet — expected until the Wave C 6.000-project migration + candidate matcher run.'
          : undefined,
    };
  }

  private emptyNearby(projectId: string, radiusM: number) {
    return {
      projectId,
      radiusM,
      generatedAt: new Date().toISOString(),
      items: [],
      meta: {
        sourceVersion: '1',
        nextCursor: null,
        note: 'project has no coordinates yet',
      },
    };
  }

  private toNearbyItem(r: NearbyRow) {
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
      freshness: {
        lastObservedAt: r.lastObservedAt,
        score: r.dataConfidence,
      },
      priceSummary: null, // Wave A has no priced catalog items yet
    };
  }

  private toPublicProject(p: {
    id: string;
    code: string;
    slug: string;
    name: string;
    projectType: string | null;
    projectStatus: string | null;
    description: string | null;
    addressText: string | null;
    provinceCode: string | null;
    districtCode: string | null;
    wardCode: string | null;
    latitude: number | null;
    longitude: number | null;
    developerName: string | null;
  }) {
    // No raw source payload (GlobalProjectSource.sourcePayload) leaks out here.
    return {
      id: p.id,
      code: p.code,
      slug: p.slug,
      name: p.name,
      projectType: p.projectType,
      status: p.projectStatus,
      description: p.description,
      address: p.addressText,
      province: p.provinceCode,
      district: p.districtCode,
      ward: p.wardCode,
      latitude: p.latitude,
      longitude: p.longitude,
      developerName: p.developerName,
    };
  }
}
