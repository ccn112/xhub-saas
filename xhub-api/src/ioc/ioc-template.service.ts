import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { validateGeometry } from './ioc.geometry';

/**
 * IOC Template Gallery + clone-to-edit (DT-04).
 *
 * The end-user workflow the owner asked for is "xem bộ template mẫu/chuẩn xong
 * rồi nhân bản và sửa" — browse, clone, tweak — NOT draw on a blank canvas.
 *
 * ARCHITECTURE (mirrors Blueprint → Launch Factory provisioning):
 *   • `IocTemplate` is a SHARED / platform-plane catalog row: no tenantId, no
 *     RLS, no tenant data. It holds neutral JSON specs only.
 *   • `clone()` MATERIALISES those specs as fresh, tenant-scoped rows inside the
 *     CALLING tenant's RLS transaction (TenantScopeInterceptor → withTenant).
 *     One tenant therefore never reads another tenant's live twin: it reads a
 *     shared spec and gets its OWN copy.
 *
 * HONESTY (Constitution #12) — the clone never invents data:
 *   • a template zone binds to a REAL OrgUnit of the calling tenant only when a
 *     code/keyword heuristic finds a plausible one; otherwise the zone is left
 *     UNBOUND and returned in `unmappedZones` for the user to assign manually.
 *     No placeholder OrgUnit is ever created.
 *   • a data layer that needs a Management-OS metric (`metricCode`) is created
 *     only when that metric EXISTS in the calling tenant; otherwise it is SKIPPED
 *     and returned in `skippedDataLayers` with the reason.
 *   • only org-grouped (`zoneLevel`) layers are attached to zone bindings — a
 *     metric grouped by metricId cannot honestly colour a department zone.
 */

interface ZoneSpec {
  id: string;
  name: string;
  kind: string;
  icon?: string | null;
  orgHint?: { codes?: string[]; keywords?: string[]; type?: string } | null;
  polygon: Array<{ x: number; y: number }>;
}

interface LayerSpec {
  code: string;
  name: string;
  sourceKey: string;
  entityKey: string;
  zoneLevel?: boolean;
  metricCode?: string;
  query: any;
  aggregation: any;
  refreshPolicy: string;
  visualMapping: any;
}

const TEMPLATE_PUBLIC_FIELDS = {
  id: true,
  code: true,
  name: true,
  industry: true,
  twinType: true,
  description: true,
  version: true,
  status: true,
  floorPlanSpec: true,
  sceneSpec: true,
  dataLayerSpecs: true,
  dashboardSpec: true,
  iconSetCodes: true,
  checksum: true,
  publishedAt: true,
} as const;

/** Strip Vietnamese diacritics so "Kế toán" matches the keyword "ke toan". */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

@Injectable()
export class IocTemplateService {
  constructor(private readonly prisma: PrismaService) {}
  private get db() {
    return this.prisma.db;
  }

  private async audit(tenantId: string, code: string, action: string, actorId: string, data: Record<string, unknown> = {}) {
    await this.db.auditLog.create({
      data: {
        tenantId,
        instanceCode: code,
        actorId,
        action: `ioc.${action}`,
        detail: JSON.stringify(data).slice(0, 500),
        at: new Date(),
      },
    });
  }

  // ---- catalog reads (SHARED — no tenant filter, by design) ------------------

  /**
   * List PUBLISHED templates. This is a PUBLIC platform catalog read: the rows
   * carry no tenant data at all, so every authenticated tenant user sees the
   * same gallery (exactly like the Blueprint catalog).
   */
  async list(filter: { industry?: string; twinType?: string; status?: string } = {}) {
    const items = await this.db.iocTemplate.findMany({
      where: {
        status: filter.status ? String(filter.status).toUpperCase() : 'PUBLISHED',
        ...(filter.twinType ? { twinType: String(filter.twinType).toUpperCase() } : {}),
        ...(filter.industry ? { industry: { contains: filter.industry, mode: 'insensitive' as const } } : {}),
      },
      orderBy: [{ code: 'asc' }, { version: 'desc' }],
      select: TEMPLATE_PUBLIC_FIELDS,
    });
    return {
      items: items.map((t) => ({
        ...t,
        zoneCount: ((t.floorPlanSpec as any)?.zones ?? []).length,
        dataLayerCount: ((t.dataLayerSpecs as any) ?? []).length,
        widgetCount: ((t.dashboardSpec as any)?.widgets ?? []).length,
      })),
      count: items.length,
    };
  }

  async get(id: string) {
    const tpl = await this.db.iocTemplate.findFirst({ where: { id }, select: TEMPLATE_PUBLIC_FIELDS });
    if (!tpl) throw new NotFoundException(`ioc template not found: ${id}`);
    return tpl;
  }

  // ---- clone -----------------------------------------------------------------

  /**
   * Materialise a template into a NEW tenant-scoped DRAFT the caller can edit.
   *
   * body: { floorId?, name?, siteName? } — `floorId` targets an existing floor;
   * otherwise a site + floor are ensured for this template in the calling tenant.
   */
  async clone(tenantId: string, actorId: string, templateId: string, body: any = {}) {
    const tpl = await this.db.iocTemplate.findFirst({ where: { id: templateId } });
    if (!tpl) throw new NotFoundException(`ioc template not found: ${templateId}`);
    if (tpl.status !== 'PUBLISHED') throw new BadRequestException(`template ${tpl.code} is ${tpl.status}, only a PUBLISHED template can be cloned`);

    const planSpec: any = tpl.floorPlanSpec ?? {};
    const sceneSpec: any = tpl.sceneSpec ?? {};
    const layerSpecs: LayerSpec[] = (tpl.dataLayerSpecs as any) ?? [];
    const dashSpec: any = tpl.dashboardSpec ?? {};
    const zoneSpecs: ZoneSpec[] = planSpec.zones ?? [];
    if (!zoneSpecs.length) throw new BadRequestException(`template ${tpl.code} has no zones to clone`);

    const stamp = Date.now().toString(36).toUpperCase();

    // 1) Target floor — an EXISTING one the caller picked, or ensure our own.
    let floor = body?.floorId ? await this.db.twinFloor.findFirst({ where: { id: body.floorId, tenantId } }) : null;
    if (body?.floorId && !floor) throw new NotFoundException(`floor not found: ${body.floorId}`);
    let site = floor ? await this.db.twinSite.findFirst({ where: { id: floor.siteId, tenantId } }) : null;

    if (!floor) {
      const siteCode = `${tpl.code}-SITE`;
      site =
        (await this.db.twinSite.findFirst({ where: { tenantId, code: siteCode } })) ??
        (await this.db.twinSite.create({
          data: {
            tenantId,
            code: siteCode,
            name: body?.siteName ?? `${tpl.name} — địa điểm mẫu`,
            createdBy: actorId,
          },
        }));
      const floorCode = `${tpl.code}-F1`;
      floor =
        (await this.db.twinFloor.findFirst({ where: { tenantId, code: floorCode } })) ??
        (await this.db.twinFloor.create({
          data: { tenantId, siteId: site.id, code: floorCode, name: 'Tầng 1', level: 1, createdBy: actorId },
        }));
    }

    // 2) Best-effort zone → REAL OrgUnit binding inside THIS tenant only.
    const orgUnits = await this.db.orgUnit.findMany({ where: { tenantId }, select: { id: true, code: true, name: true, type: true } });
    const byCode = new Map(orgUnits.map((o) => [o.code.toUpperCase(), o]));
    const taken = new Set<string>();

    const resolveZone = (z: ZoneSpec) => {
      const hint = z.orgHint ?? {};
      for (const code of hint.codes ?? []) {
        const hit = byCode.get(String(code).toUpperCase());
        if (hit && !taken.has(hit.id)) return { org: hit, how: `code:${hit.code}` };
      }
      for (const kw of hint.keywords ?? []) {
        const needle = fold(kw);
        const hit = orgUnits.find((o) => !taken.has(o.id) && (fold(o.name).includes(needle) || fold(o.code).includes(needle)));
        if (hit) return { org: hit, how: `keyword:${kw}` };
      }
      return null;
    };

    const bound: Array<{ zoneId: string; zoneName: string; orgUnitId: string; orgCode: string; matchedBy: string; iconKey: string | null }> = [];
    const unmappedZones: Array<{ zoneId: string; zoneName: string; reason: string }> = [];
    const zones = zoneSpecs.map((z) => {
      const hit = resolveZone(z);
      if (hit) {
        taken.add(hit.org.id);
        bound.push({ zoneId: z.id, zoneName: z.name, orgUnitId: hit.org.id, orgCode: hit.org.code, matchedBy: hit.how, iconKey: z.icon ?? null });
        return { id: z.id, name: z.name, kind: z.kind, orgUnitId: hit.org.id, polygon: z.polygon };
      }
      unmappedZones.push({ zoneId: z.id, zoneName: z.name, reason: 'chưa gán đơn vị — không tìm thấy đơn vị phù hợp trong cây tổ chức của tenant' });
      return { id: z.id, name: z.name, kind: z.kind, orgUnitId: null, polygon: z.polygon };
    });

    // Re-validate exactly like a hand-drawn plan — a template is not trusted more.
    const geometry = validateGeometry({ walls: planSpec.walls ?? [], zones });

    // 3) Data layers, re-pointed at THIS tenant's own metrics.
    const createdLayers: Array<{ id: string; code: string; zoneLevel: boolean }> = [];
    const skippedDataLayers: Array<{ code: string; reason: string }> = [];
    for (const spec of layerSpecs) {
      let query = spec.query;
      if (spec.metricCode) {
        const metric = await this.db.metricDefinition.findFirst({ where: { tenantId, code: spec.metricCode }, select: { id: true } });
        if (!metric) {
          skippedDataLayers.push({ code: spec.code, reason: `tenant chưa có chỉ số "${spec.metricCode}" — bỏ qua lớp dữ liệu thay vì hiển thị số giả` });
          continue;
        }
        query = { ...spec.query, filters: [...(spec.query?.filters ?? []), { field: 'metricId', operator: 'EQ', value: metric.id }] };
      }
      const existing = await this.db.dataLayerDefinition.findFirst({ where: { tenantId, code: spec.code } });
      const row = existing
        ? existing
        : await this.db.dataLayerDefinition.create({
            data: {
              tenantId,
              code: spec.code,
              name: spec.name,
              sourceKey: spec.sourceKey,
              entityKey: spec.entityKey,
              query: query as any,
              aggregation: spec.aggregation as any,
              refreshPolicy: spec.refreshPolicy,
              visualMapping: spec.visualMapping as any,
              createdBy: actorId,
            },
          });
      createdLayers.push({ id: row.id, code: spec.code, zoneLevel: spec.zoneLevel !== false });
    }
    const zoneLayerIds = createdLayers.filter((l) => l.zoneLevel).map((l) => l.id);
    const layerIdByCode = new Map(createdLayers.map((l) => [l.code, l.id]));

    // 4) DRAFT plan + DRAFT scene + bindings (bound zones ONLY).
    const plan = await this.db.floorPlanDefinition.create({
      data: {
        tenantId,
        floorId: floor.id,
        name: body?.name ? `${body.name} — mặt bằng` : `${planSpec.name ?? tpl.name} (bản sao ${stamp})`,
        metersPerUnit: planSpec.metersPerUnit ?? 1,
        originX: planSpec.originX ?? 0,
        originY: planSpec.originY ?? 0,
        geometry: geometry as any,
        createdBy: actorId,
      },
    });

    const scene = await this.db.twinScene.create({
      data: {
        tenantId,
        name: body?.name ?? `${sceneSpec.name ?? tpl.name} (bản sao ${stamp})`,
        floorId: floor.id,
        planId: plan.id,
        themeKey: sceneSpec.themeKey ?? 'ioc-navy',
        wallHeightMeters: sceneSpec.wallHeightMeters ?? 3,
        createdBy: actorId,
      },
    });

    for (const b of bound) {
      await this.db.sceneBinding.create({
        data: {
          tenantId,
          sceneId: scene.id,
          zoneId: b.zoneId,
          bindingType: 'ORG_UNIT',
          bindingId: b.orgUnitId,
          iconKey: b.iconKey,
          materialKey: 'status-dynamic',
          dataLayerIds: zoneLayerIds,
        },
      });
    }

    // 5) DRAFT dashboard copy — code made unique inside THIS tenant.
    let dashCode = String(dashSpec.code ?? `DASH-${tpl.code}`);
    if (await this.db.dashboardDefinition.findFirst({ where: { tenantId, code: dashCode } })) {
      dashCode = `${dashCode}-${stamp}`;
    }
    const widgets = (dashSpec.widgets ?? []).map((w: any) => ({
      id: w.id,
      type: w.type,
      title: w.title ?? null,
      dataLayerId: w.layerCode ? (layerIdByCode.get(w.layerCode) ?? null) : null,
      layout: w.layout,
    }));
    const dashboard = await this.db.dashboardDefinition.create({
      data: {
        tenantId,
        code: dashCode,
        name: body?.name ? `${body.name} — bảng điều khiển` : `${dashSpec.name ?? tpl.name} (bản sao ${stamp})`,
        viewType: dashSpec.viewType ?? 'OFFICE_TWIN',
        sceneId: scene.id,
        globalFilters: dashSpec.globalFilters ?? [],
        widgets: widgets as any,
        createdBy: actorId,
      },
    });

    // 6) Make sure the template's icons exist in this tenant's catalog.
    let iconsEnsured = 0;
    for (const key of [...new Set(zoneSpecs.map((z) => z.icon).filter(Boolean) as string[])]) {
      const has = await this.db.iconAsset.findFirst({ where: { tenantId, key } });
      if (!has) {
        await this.db.iconAsset.create({ data: { tenantId, key, label: key, type: 'BUILT_IN' } });
        iconsEnsured++;
      }
    }

    await this.audit(tenantId, scene.id, 'template.clone', actorId, {
      templateId: tpl.id,
      templateCode: tpl.code,
      templateVersion: tpl.version,
      planId: plan.id,
      dashboardId: dashboard.id,
      boundZones: bound.length,
      unmappedZones: unmappedZones.length,
      skippedDataLayers: skippedDataLayers.length,
    });

    return {
      template: { id: tpl.id, code: tpl.code, name: tpl.name, version: tpl.version, twinType: tpl.twinType },
      siteId: site?.id ?? floor.siteId,
      floorId: floor.id,
      planId: plan.id,
      sceneId: scene.id,
      dashboardId: dashboard.id,
      dashboardCode: dashCode,
      status: 'DRAFT',
      zoneCount: zones.length,
      boundZones: bound,
      unmappedZones,
      dataLayers: createdLayers.map((l) => ({ id: l.id, code: l.code, zoneLevel: l.zoneLevel })),
      skippedDataLayers,
      iconsEnsured,
      editorPath: `/ioc/studio/scenes/${scene.id}/floor-plan`,
      note:
        unmappedZones.length > 0
          ? `${unmappedZones.length}/${zones.length} vùng chưa gán được đơn vị — hãy gán thủ công trong trình vẽ. Hệ thống KHÔNG tự tạo đơn vị ảo.`
          : 'Tất cả vùng đã gán vào đơn vị thật của tenant.',
    };
  }
}
