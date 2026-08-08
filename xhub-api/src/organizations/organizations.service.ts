import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * DATA-01 (Wave A) Organization Master reads. Global, non-RLS tables (see
 * prisma/schema.prisma's DATA-01 block comment and scripts/rls-setup.mjs) —
 * same posture as ProjectCatalogService/ProvidersService: no
 * TenantScopeInterceptor, no @RequirePermission (platform-internal MDM read,
 * not yet exposed publicly — XOffice consumes it server-to-server via the
 * canonicalCustomerId seam, not a direct mobile/public route).
 */
@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    page?: number;
    limit?: number;
    q?: string;
    researchStatus?: string;
    organizationType?: string;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const where: Record<string, unknown> = {};
    if (params.q) where.normalizedName = { contains: params.q.toLowerCase() };
    // DATA-02's research-status filter (doc: 124 DISCOVERED rows must stay
    // queryable/reviewable, never just disappear — see docs/data02/).
    if (params.researchStatus) where.researchStatus = params.researchStatus;
    if (params.organizationType)
      where.organizationType = params.organizationType;

    const [items, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        include: {
          qualification: true,
          media: {
            where: { status: 'CACHED' },
            take: 1,
            orderBy: { retrievedAt: 'desc' },
          },
        },
        orderBy: { legalName: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.organization.count({ where }),
    ]);
    return {
      items: items.map((o) => this.toSummary(o)),
      meta: { page, limit, total },
    };
  }

  async getById(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        qualification: true,
        locations: true,
        aliases: true,
        fieldObservations: true,
        personRoles: { include: { person: true } },
        serviceCapabilities: true,
        media: {
          where: { status: 'CACHED' },
          orderBy: { retrievedAt: 'desc' },
        },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return this.toDetail(org);
  }

  async getQualifications(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');
    const [current, events] = await Promise.all([
      this.prisma.organizationQualification.findUnique({
        where: { organizationId: id },
      }),
      this.prisma.organizationQualificationEvent.findMany({
        where: { organizationId: id },
        orderBy: { observedAt: 'desc' },
      }),
    ]);
    return {
      current: current
        ? {
            status: current.status,
            documentNo: current.documentNo,
            effectiveDate: current.effectiveDate,
            expiryDate: current.expiryDate,
            daysToExpiry: current.daysToExpiry,
          }
        : null,
      // Append-only history — never mutated, always the full event trail.
      events: events.map((e) => ({
        eventType: e.eventType,
        documentNo: e.documentNo,
        effectiveDate: e.effectiveDate,
        qualificationStatus: e.qualificationStatus,
        sourceUrl: e.sourceUrl,
        observedAt: e.observedAt,
      })),
    };
  }

  async getProjects(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');
    const relations = await this.prisma.projectOrganizationRelation.findMany({
      where: { organizationId: id },
      include: { globalProject: true },
    });
    return {
      items: relations.map((r) => ({
        globalProjectId: r.globalProjectId,
        projectName: r.globalProject.name,
        relationshipType: r.relationshipType,
        relationshipStatus: r.relationshipStatus,
        confidence: r.confidence,
      })),
    };
  }

  private toSummary(o: {
    id: string;
    legalName: string;
    shortName: string | null;
    provinceCode: string | null;
    operatorType: string | null;
    organizationType: string;
    researchStatus: string | null;
    qualification: { status: string } | null;
    media: { imageType: string | null; localMediaPath: string | null }[];
  }) {
    return {
      id: o.id,
      legalName: o.legalName,
      shortName: o.shortName,
      province: o.provinceCode,
      operatorType: o.operatorType,
      organizationType: o.organizationType,
      researchStatus: o.researchStatus,
      qualificationStatus: o.qualification?.status ?? 'UNKNOWN',
      displayImage: this.toDisplayImage(o.media[0]),
    };
  }

  // DATA-03 media handoff §7 list-UI contract: expose only a servable URL +
  // type, never localMediaPath (a server filesystem path) directly. Actual
  // byte-serving route is a follow-up (static/CDN); for now the path is
  // relative under /media, matching storage/media/organizations/<orgId>/<file>.
  private toDisplayImage(m?: {
    imageType: string | null;
    localMediaPath: string | null;
  }) {
    if (!m?.localMediaPath) return null;
    const filename = m.localMediaPath.split('/').pop();
    return {
      url: `/media/organizations/${filename}`,
      type: m.imageType ?? 'LOGO',
    };
  }

  private toDetail(o: {
    id: string;
    legalName: string;
    shortName: string | null;
    taxCode: string | null;
    website: string | null;
    companyPhone: string | null;
    hotline: string | null;
    generalEmail: string | null;
    operatorType: string | null;
    organizationType: string;
    researchStatus: string | null;
    provinceCode: string | null;
    qualification: {
      status: string;
      documentNo: string | null;
      effectiveDate: Date | null;
      expiryDate: Date | null;
    } | null;
    locations: {
      locationType: string;
      addressRaw: string | null;
      isCurrent: boolean;
    }[];
    aliases: { alias: string; aliasType: string }[];
    personRoles: {
      roleType: string;
      status: string;
      person: { fullName: string };
    }[];
    fieldObservations: { fieldName: string; status: string }[];
    serviceCapabilities: { categoryCode: string }[];
    media: { imageType: string | null; localMediaPath: string | null }[];
  }) {
    // No raw source payload (OrgSourceRecord.raw) leaks out here — only
    // resolved/derived fields and their evidence status.
    return {
      id: o.id,
      legalName: o.legalName,
      shortName: o.shortName,
      taxCode: o.taxCode,
      website: o.website,
      companyPhone: o.companyPhone,
      hotline: o.hotline,
      generalEmail: o.generalEmail,
      operatorType: o.operatorType,
      organizationType: o.organizationType,
      researchStatus: o.researchStatus,
      province: o.provinceCode,
      qualification: o.qualification
        ? {
            status: o.qualification.status,
            documentNo: o.qualification.documentNo,
            effectiveDate: o.qualification.effectiveDate,
            expiryDate: o.qualification.expiryDate,
          }
        : null,
      locations: o.locations.map((l) => ({
        type: l.locationType,
        address: l.addressRaw,
        isCurrent: l.isCurrent,
      })),
      aliases: o.aliases.map((a) => ({
        alias: a.alias,
        type: a.aliasType,
      })),
      representatives: o.personRoles.map((r) => ({
        name: r.person.fullName,
        roleType: r.roleType,
        status: r.status,
      })),
      fieldCoverage: o.fieldObservations.map((f) => ({
        field: f.fieldName,
        status: f.status,
      })),
      // DATA-02's taxonomy (SECURITY/CLEANING/ELEVATOR/...) — empty for
      // non-contractor organizationTypes (e.g. PROPERTY_OPERATOR).
      serviceCapabilities: o.serviceCapabilities.map((c) => c.categoryCode),
      media: o.media.map((m) => this.toDisplayImage(m)).filter(Boolean),
    };
  }
}
