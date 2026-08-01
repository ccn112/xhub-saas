import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DASHBOARD_VIEW_TYPES, WIDGET_TYPES } from './ioc.catalog';
import { checksumOf } from './ioc.geometry';
import { DataLayerService } from './data-layer.service';
import { TwinStudioService } from './twin-studio.service';

/**
 * Dashboard builder + IOC runtime (DT-03).
 *
 * A dashboard is pure CONFIGURATION: grid layout + widget types + references to
 * a scene and to data layers. No custom JavaScript and no raw SQL may appear in
 * tenant configuration (doc 06) — widget `type` is a closed enum and
 * `dataLayerId` must resolve to a DataLayerDefinition in the same tenant.
 *
 * Published versions are immutable and append-only (Constitution #5, AT-002);
 * rollback re-points `activeVersionNo` without deleting (AT-003).
 *
 * AT-009 "custom tenant dashboard without a code change" is satisfied because
 * the runtime resolves widgets generically from the published payload — adding a
 * dashboard is a POST, never a deploy.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataLayers: DataLayerService,
    private readonly studio: TwinStudioService,
  ) {}
  private get db() {
    return this.prisma.db;
  }

  private async audit(tenantId: string, code: string, action: string, actorId: string, data: Record<string, unknown> = {}) {
    await this.db.auditLog.create({
      data: { tenantId, instanceCode: code, actorId, action: `ioc.${action}`, detail: JSON.stringify(data).slice(0, 500), at: new Date() },
    });
  }

  private async validateWidgets(tenantId: string, widgets: any): Promise<any[]> {
    if (!Array.isArray(widgets)) throw new BadRequestException('widgets must be an array');
    if (widgets.length > 40) throw new BadRequestException('too many widgets (max 40)');
    const ids = new Set<string>();
    const layerIds = new Set<string>();
    const out = widgets.map((w: any, i: number) => {
      if (!w?.id || typeof w.id !== 'string') throw new BadRequestException(`widgets[${i}]: id is required`);
      if (ids.has(w.id)) throw new BadRequestException(`widgets[${i}]: duplicate widget id "${w.id}"`);
      ids.add(w.id);
      const type = String(w.type ?? '').toUpperCase();
      if (!(WIDGET_TYPES as readonly string[]).includes(type)) throw new BadRequestException(`widgets[${i}]: invalid type ${w.type}`);
      const l = w.layout ?? {};
      for (const k of ['x', 'y', 'w', 'h']) {
        if (!Number.isInteger(l[k])) throw new BadRequestException(`widgets[${i}].layout.${k} must be an integer`);
      }
      if (l.w < 1 || l.h < 1) throw new BadRequestException(`widgets[${i}]: layout w/h must be >= 1`);
      if (l.x < 0 || l.y < 0 || l.x + l.w > 12) throw new BadRequestException(`widgets[${i}]: layout must fit the 12-column grid`);
      if (w.dataLayerId) layerIds.add(String(w.dataLayerId));
      // Explicitly strip anything that smells like executable/tenant-supplied logic.
      if (w.script || w.sql || w.js || w.html) throw new BadRequestException(`widgets[${i}]: custom script/SQL/HTML is not allowed in dashboard configuration`);
      return {
        id: w.id,
        type,
        title: typeof w.title === 'string' ? w.title.slice(0, 120) : null,
        dataLayerId: w.dataLayerId ?? null,
        layout: { x: l.x, y: l.y, w: l.w, h: l.h },
      };
    });
    if (layerIds.size) {
      const found = await this.db.dataLayerDefinition.findMany({ where: { tenantId, id: { in: [...layerIds] } }, select: { id: true } });
      const missing = [...layerIds].filter((id) => !found.some((f) => f.id === id));
      if (missing.length) throw new BadRequestException(`unknown data layer(s) referenced by widgets: ${missing.join(', ')}`);
    }
    return out;
  }

  async list(tenantId: string) {
    const items = await this.db.dashboardDefinition.findMany({ where: { tenantId }, orderBy: { code: 'asc' } });
    return { items, count: items.length };
  }

  async get(tenantId: string, id: string) {
    const d = await this.db.dashboardDefinition.findFirst({ where: { id, tenantId } });
    if (!d) throw new NotFoundException(`dashboard not found: ${id}`);
    const versions = await this.db.dashboardVersion.findMany({
      where: { tenantId, dashboardId: id },
      orderBy: { versionNo: 'desc' },
      select: { id: true, versionNo: true, checksum: true, status: true, publishedAt: true, publishedBy: true, note: true },
    });
    return { ...d, versions };
  }

  async create(tenantId: string, actorId: string, body: any) {
    if (!body?.code) throw new BadRequestException('code is required');
    if (!body?.name) throw new BadRequestException('name is required');
    const viewType = String(body.viewType ?? 'CUSTOM').toUpperCase();
    if (!(DASHBOARD_VIEW_TYPES as readonly string[]).includes(viewType)) throw new BadRequestException(`invalid viewType ${viewType}`);
    if (body.sceneId) {
      const scene = await this.db.twinScene.findFirst({ where: { id: body.sceneId, tenantId } });
      if (!scene) throw new BadRequestException(`scene not found in this tenant: ${body.sceneId}`);
    }
    const widgets = await this.validateWidgets(tenantId, body.widgets ?? []);
    const d = await this.db.dashboardDefinition.create({
      data: {
        tenantId,
        code: body.code,
        name: body.name,
        viewType,
        sceneId: body.sceneId ?? null,
        globalFilters: Array.isArray(body.globalFilters) ? body.globalFilters : [],
        widgets: widgets as any,
        createdBy: actorId,
      },
    });
    await this.audit(tenantId, d.code, 'dashboard.create', actorId, { id: d.id, viewType, widgets: widgets.length });
    return d;
  }

  async update(tenantId: string, actorId: string, id: string, body: any) {
    const d = await this.db.dashboardDefinition.findFirst({ where: { id, tenantId } });
    if (!d) throw new NotFoundException(`dashboard not found: ${id}`);
    if (body?.revision != null && body.revision !== d.revision) {
      throw new ConflictException(`stale revision: sent ${body.revision}, current ${d.revision}`);
    }
    const data: Record<string, unknown> = { updatedBy: actorId, revision: { increment: 1 } };
    if (body?.name) data.name = body.name;
    if (body?.sceneId !== undefined) {
      if (body.sceneId) {
        const scene = await this.db.twinScene.findFirst({ where: { id: body.sceneId, tenantId } });
        if (!scene) throw new BadRequestException(`scene not found in this tenant: ${body.sceneId}`);
      }
      data.sceneId = body.sceneId;
    }
    if (body?.globalFilters !== undefined) data.globalFilters = Array.isArray(body.globalFilters) ? body.globalFilters : [];
    if (body?.widgets !== undefined) data.widgets = (await this.validateWidgets(tenantId, body.widgets)) as any;
    if (body?.status) {
      const status = String(body.status).toUpperCase();
      if (!['DRAFT', 'IN_REVIEW', 'ARCHIVED'].includes(status)) {
        throw new BadRequestException(`dashboard status ${status} cannot be set directly — publish creates PUBLISHED`);
      }
      data.status = status;
    }
    return this.db.dashboardDefinition.update({ where: { id }, data: data as any });
  }

  async publish(tenantId: string, actorId: string, id: string, note?: string) {
    const d = await this.db.dashboardDefinition.findFirst({ where: { id, tenantId } });
    if (!d) throw new NotFoundException(`dashboard not found: ${id}`);
    const widgets = await this.validateWidgets(tenantId, d.widgets);
    if (!widgets.length) throw new BadRequestException('cannot publish a dashboard with no widgets');
    const last = await this.db.dashboardVersion.findFirst({ where: { tenantId, dashboardId: id }, orderBy: { versionNo: 'desc' } });
    const versionNo = (last?.versionNo ?? 0) + 1;
    const payload = {
      dashboardId: d.id,
      code: d.code,
      name: d.name,
      viewType: d.viewType,
      sceneId: d.sceneId,
      globalFilters: d.globalFilters,
      versionNo,
      widgets,
    };
    const checksum = checksumOf(payload);
    await this.db.dashboardVersion.updateMany({ where: { tenantId, dashboardId: id, status: 'PUBLISHED' }, data: { status: 'SUPERSEDED' } });
    const version = await this.db.dashboardVersion.create({
      data: { tenantId, dashboardId: id, versionNo, payload: payload as any, checksum, publishedBy: actorId, note: note ?? null },
    });
    await this.db.dashboardDefinition.update({ where: { id }, data: { status: 'PUBLISHED', activeVersionNo: versionNo, updatedBy: actorId } });
    await this.audit(tenantId, d.code, 'dashboard.publish', actorId, { versionNo, checksum });
    return version;
  }

  async listVersions(tenantId: string, dashboardId: string) {
    const items = await this.db.dashboardVersion.findMany({ where: { tenantId, dashboardId }, orderBy: { versionNo: 'desc' } });
    return { items, count: items.length };
  }

  async rollback(tenantId: string, actorId: string, dashboardId: string, versionNo: number) {
    const d = await this.db.dashboardDefinition.findFirst({ where: { id: dashboardId, tenantId } });
    if (!d) throw new NotFoundException(`dashboard not found: ${dashboardId}`);
    const target = await this.db.dashboardVersion.findFirst({ where: { tenantId, dashboardId, versionNo } });
    if (!target) throw new NotFoundException(`version ${versionNo} not found`);
    await this.db.dashboardDefinition.update({ where: { id: dashboardId }, data: { activeVersionNo: versionNo, updatedBy: actorId } });
    await this.audit(tenantId, d.code, 'dashboard.rollback', actorId, { versionNo });
    const total = await this.db.dashboardVersion.count({ where: { tenantId, dashboardId } });
    return { dashboardId, activeVersionNo: versionNo, versionCount: total, deleted: 0 };
  }

  // ---- runtime ---------------------------------------------------------------

  /**
   * Resolve a PUBLISHED dashboard for the viewer: the frozen widget layout, the
   * published scene geometry, and every referenced data layer EXECUTED once.
   * Always aggregate scope — the runtime never requests individual rows.
   */
  async runtime(tenantId: string, actorId: string, codeOrId: string, opts: { permissions?: string[] } = {}) {
    const d =
      (await this.db.dashboardDefinition.findFirst({ where: { tenantId, code: codeOrId } })) ??
      (await this.db.dashboardDefinition.findFirst({ where: { tenantId, id: codeOrId } }));
    if (!d) throw new NotFoundException(`dashboard not found: ${codeOrId}`);
    if (d.activeVersionNo == null) throw new NotFoundException(`dashboard ${d.code} has no published version`);
    const version = await this.db.dashboardVersion.findFirst({ where: { tenantId, dashboardId: d.id, versionNo: d.activeVersionNo } });
    if (!version) throw new NotFoundException(`active version ${d.activeVersionNo} missing`);
    const payload = version.payload as any;
    const widgets: any[] = payload.widgets ?? [];

    const layerIds = [...new Set(widgets.map((w) => w.dataLayerId).filter(Boolean))] as string[];
    const layers = layerIds.length ? await this.db.dataLayerDefinition.findMany({ where: { tenantId, id: { in: layerIds } } }) : [];
    const results: Record<string, unknown> = {};
    for (const l of layers) {
      try {
        results[l.id] = await this.dataLayers.executeDefinition(tenantId, actorId, l as any, { scope: 'aggregate', permissions: opts.permissions });
      } catch (e) {
        results[l.id] = { dataLayerId: l.id, code: l.code, name: l.name, rows: [], total: 0, error: (e as Error).message };
      }
    }

    let scene: unknown = null;
    if (payload.sceneId) {
      try {
        scene = await this.studio.runtimeScene(tenantId, payload.sceneId);
      } catch {
        scene = null; // an unpublished scene must not break the dashboard (2D/list still renders)
      }
    }

    return {
      dashboard: { id: d.id, code: payload.code, name: payload.name, viewType: payload.viewType, versionNo: version.versionNo, checksum: version.checksum, publishedAt: version.publishedAt, globalFilters: payload.globalFilters ?? [] },
      widgets,
      scene,
      dataLayers: results,
      resolvedAt: new Date().toISOString(),
    };
  }
}
