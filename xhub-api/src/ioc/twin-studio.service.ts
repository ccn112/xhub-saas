import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { XofficePrismaService } from '../xoffice-prisma/xoffice-prisma.service';
import { BINDING_TYPES } from './ioc.catalog';
import { checksumOf, validateGeometry, areaSqMeters, type Geometry } from './ioc.geometry';

/**
 * Twin Studio (DT-01): TwinSite → TwinFloor → FloorPlanDefinition (draft) →
 * FloorPlanVersion (immutable) → TwinScene + SceneBinding → TwinSceneVersion.
 *
 * Lifecycle (doc 03): DRAFT → IN_REVIEW → PUBLISHED → SUPERSEDED → ARCHIVED.
 * Publishing NEVER mutates an existing version row: it appends a new
 * (versionNo, payload, checksum) and marks the previous PUBLISHED row SUPERSEDED
 * (Constitution #5, AT-002). Rollback flips `activeVersionNo` back and never
 * deletes (AT-003). Every publish/rollback writes an AuditLog row.
 *
 * Runs inside the caller's withTenant() transaction (XofficeTenantScopeInterceptor), so
 * every statement is RLS-scoped; the in-code tenantId filters are defence in depth.
 */
@Injectable()
export class TwinStudioService {
  constructor(private readonly prisma: XofficePrismaService) {}
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

  // ---- sites / floors --------------------------------------------------------

  async listSites(tenantId: string) {
    const items = await this.db.twinSite.findMany({
      where: { tenantId },
      orderBy: [{ code: 'asc' }],
      include: { floors: { orderBy: { level: 'asc' } } },
    });
    return { items, count: items.length };
  }

  async createSite(tenantId: string, actorId: string, body: any) {
    if (!body?.code) throw new BadRequestException('code is required');
    if (!body?.name) throw new BadRequestException('name is required');
    const site = await this.db.twinSite.create({
      data: {
        tenantId,
        code: body.code,
        name: body.name,
        address: body.address ?? null,
        timezone: body.timezone ?? 'Asia/Ho_Chi_Minh',
        createdBy: actorId,
      },
    });
    await this.audit(tenantId, site.code, 'site.create', actorId, { id: site.id });
    return site;
  }

  async createFloor(tenantId: string, actorId: string, body: any) {
    if (!body?.siteId) throw new BadRequestException('siteId is required');
    if (!body?.code) throw new BadRequestException('code is required');
    if (!body?.name) throw new BadRequestException('name is required');
    const site = await this.db.twinSite.findFirst({ where: { id: body.siteId, tenantId } });
    if (!site) throw new NotFoundException(`site not found: ${body.siteId}`);
    const floor = await this.db.twinFloor.create({
      data: {
        tenantId,
        siteId: site.id,
        code: body.code,
        name: body.name,
        buildingLabel: body.buildingLabel ?? null,
        level: body.level ?? 1,
        createdBy: actorId,
      },
    });
    await this.audit(tenantId, floor.code, 'floor.create', actorId, { id: floor.id, siteId: site.id });
    return floor;
  }

  // ---- floor plans -----------------------------------------------------------

  async listPlans(tenantId: string, filter: { floorId?: string } = {}) {
    const items = await this.db.floorPlanDefinition.findMany({
      where: { tenantId, ...(filter.floorId ? { floorId: filter.floorId } : {}) },
      orderBy: [{ updatedAt: 'desc' }],
    });
    return { items, count: items.length };
  }

  async getPlan(tenantId: string, id: string) {
    const plan = await this.db.floorPlanDefinition.findFirst({ where: { id, tenantId } });
    if (!plan) throw new NotFoundException(`floor plan not found: ${id}`);
    const versions = await this.db.floorPlanVersion.findMany({
      where: { tenantId, planId: id },
      orderBy: { versionNo: 'desc' },
      select: { id: true, versionNo: true, checksum: true, status: true, publishedAt: true, publishedBy: true, note: true },
    });
    return { ...plan, versions };
  }

  async createPlan(tenantId: string, actorId: string, body: any) {
    if (!body?.floorId) throw new BadRequestException('floorId is required');
    if (!body?.name) throw new BadRequestException('name is required');
    const floor = await this.db.twinFloor.findFirst({ where: { id: body.floorId, tenantId } });
    if (!floor) throw new NotFoundException(`floor not found: ${body.floorId}`);
    const metersPerUnit = body.metersPerUnit ?? 1;
    if (!(typeof metersPerUnit === 'number' && metersPerUnit > 0)) {
      throw new BadRequestException('metersPerUnit must be a positive number');
    }
    const geometry = validateGeometry(body.geometry ?? { walls: [], zones: [] });
    const plan = await this.db.floorPlanDefinition.create({
      data: {
        tenantId,
        floorId: floor.id,
        name: body.name,
        metersPerUnit,
        originX: body.originX ?? 0,
        originY: body.originY ?? 0,
        geometry: geometry as any,
        createdBy: actorId,
      },
    });
    await this.audit(tenantId, plan.id, 'plan.create', actorId, { floorId: floor.id, zones: geometry.zones.length });
    return plan;
  }

  /**
   * Autosave the draft geometry. Optimistic concurrency: the caller sends the
   * `revision` it loaded; a mismatch is a 409 so two editors cannot silently
   * overwrite each other (doc 04 "autosave draft with optimistic version").
   */
  async updatePlan(tenantId: string, actorId: string, id: string, body: any) {
    const plan = await this.db.floorPlanDefinition.findFirst({ where: { id, tenantId } });
    if (!plan) throw new NotFoundException(`floor plan not found: ${id}`);
    if (body?.revision != null && body.revision !== plan.revision) {
      throw new ConflictException(`stale revision: sent ${body.revision}, current ${plan.revision}`);
    }
    const data: Record<string, unknown> = { updatedBy: actorId, revision: { increment: 1 } };
    if (body?.name) data.name = body.name;
    if (body?.metersPerUnit != null) {
      if (!(typeof body.metersPerUnit === 'number' && body.metersPerUnit > 0)) {
        throw new BadRequestException('metersPerUnit must be a positive number');
      }
      data.metersPerUnit = body.metersPerUnit;
    }
    if (body?.originX != null) data.originX = body.originX;
    if (body?.originY != null) data.originY = body.originY;
    if (body?.geometry !== undefined) data.geometry = validateGeometry(body.geometry) as any;
    if (body?.status) {
      const status = String(body.status).toUpperCase();
      if (!['DRAFT', 'IN_REVIEW', 'ARCHIVED'].includes(status)) {
        throw new BadRequestException(`plan status ${status} cannot be set directly — publish creates PUBLISHED`);
      }
      data.status = status;
    }
    return this.db.floorPlanDefinition.update({ where: { id }, data: data as any });
  }

  /** Publish an IMMUTABLE FloorPlanVersion (append-only). */
  async publishPlan(tenantId: string, actorId: string, id: string, note?: string) {
    const plan = await this.db.floorPlanDefinition.findFirst({ where: { id, tenantId } });
    if (!plan) throw new NotFoundException(`floor plan not found: ${id}`);
    const geometry = validateGeometry(plan.geometry);
    if (geometry.zones.length === 0) throw new BadRequestException('cannot publish a plan with no zones');

    const last = await this.db.floorPlanVersion.findFirst({
      where: { tenantId, planId: id },
      orderBy: { versionNo: 'desc' },
    });
    const versionNo = (last?.versionNo ?? 0) + 1;
    const payload = {
      planId: plan.id,
      floorId: plan.floorId,
      name: plan.name,
      unit: 'METER',
      versionNo,
      calibration: { metersPerUnit: plan.metersPerUnit, originX: plan.originX, originY: plan.originY },
      underlayAssetId: plan.underlayAssetId,
      walls: geometry.walls,
      zones: geometry.zones,
    };
    const checksum = checksumOf(payload);

    // Supersede the currently published version — never delete, never rewrite.
    await this.db.floorPlanVersion.updateMany({
      where: { tenantId, planId: id, status: 'PUBLISHED' },
      data: { status: 'SUPERSEDED' },
    });
    const version = await this.db.floorPlanVersion.create({
      data: { tenantId, planId: id, versionNo, payload: payload as any, checksum, publishedBy: actorId, note: note ?? null },
    });
    await this.db.floorPlanDefinition.update({
      where: { id },
      data: { status: 'PUBLISHED', activeVersionNo: versionNo, updatedBy: actorId },
    });
    await this.audit(tenantId, plan.id, 'plan.publish', actorId, { versionNo, checksum });
    return version;
  }

  async listPlanVersions(tenantId: string, planId: string) {
    const items = await this.db.floorPlanVersion.findMany({ where: { tenantId, planId }, orderBy: { versionNo: 'desc' } });
    return { items, count: items.length };
  }

  /** Re-activate an older version. Nothing is deleted (AT-003). */
  async rollbackPlan(tenantId: string, actorId: string, planId: string, versionNo: number) {
    const plan = await this.db.floorPlanDefinition.findFirst({ where: { id: planId, tenantId } });
    if (!plan) throw new NotFoundException(`floor plan not found: ${planId}`);
    const target = await this.db.floorPlanVersion.findFirst({ where: { tenantId, planId, versionNo } });
    if (!target) throw new NotFoundException(`version ${versionNo} not found`);
    await this.db.floorPlanDefinition.update({ where: { id: planId }, data: { activeVersionNo: versionNo, updatedBy: actorId } });
    await this.audit(tenantId, planId, 'plan.rollback', actorId, { versionNo });
    const total = await this.db.floorPlanVersion.count({ where: { tenantId, planId } });
    return { planId, activeVersionNo: versionNo, versionCount: total, deleted: 0 };
  }

  // ---- scenes ----------------------------------------------------------------

  async listScenes(tenantId: string) {
    const items = await this.db.twinScene.findMany({
      where: { tenantId },
      orderBy: [{ updatedAt: 'desc' }],
      include: { bindings: true },
    });
    return { items, count: items.length };
  }

  async getScene(tenantId: string, id: string) {
    const scene = await this.db.twinScene.findFirst({ where: { id, tenantId }, include: { bindings: true } });
    if (!scene) throw new NotFoundException(`scene not found: ${id}`);
    const plan = await this.db.floorPlanDefinition.findFirst({ where: { id: scene.planId, tenantId } });
    const versions = await this.db.twinSceneVersion.findMany({
      where: { tenantId, sceneId: id },
      orderBy: { versionNo: 'desc' },
      select: { id: true, versionNo: true, checksum: true, status: true, publishedAt: true, publishedBy: true, note: true },
    });
    // Resolve bound org unit names so the studio never hardcodes a department label.
    const orgIds = scene.bindings.filter((b) => b.bindingType === 'ORG_UNIT').map((b) => b.bindingId);
    const orgs = orgIds.length ? await this.db.orgUnit.findMany({ where: { tenantId, id: { in: orgIds } } }) : [];
    const orgMap = new Map(orgs.map((o) => [o.id, o]));
    return {
      ...scene,
      plan,
      geometry: plan ? validateGeometry(plan.geometry) : { walls: [], zones: [] },
      versions,
      bindings: scene.bindings.map((b) => ({
        ...b,
        orgUnit: orgMap.get(b.bindingId) ? { id: b.bindingId, code: orgMap.get(b.bindingId)!.code, name: orgMap.get(b.bindingId)!.name } : null,
      })),
    };
  }

  async createScene(tenantId: string, actorId: string, body: any) {
    if (!body?.name) throw new BadRequestException('name is required');
    if (!body?.planId) throw new BadRequestException('planId is required');
    const plan = await this.db.floorPlanDefinition.findFirst({ where: { id: body.planId, tenantId } });
    if (!plan) throw new NotFoundException(`floor plan not found: ${body.planId}`);
    const scene = await this.db.twinScene.create({
      data: {
        tenantId,
        name: body.name,
        floorId: plan.floorId,
        planId: plan.id,
        floorPlanVersionNo: body.floorPlanVersionNo ?? null,
        themeKey: body.themeKey ?? 'ioc-navy',
        wallHeightMeters: body.wallHeightMeters ?? 3,
        createdBy: actorId,
      },
    });
    await this.audit(tenantId, scene.id, 'scene.create', actorId, { planId: plan.id });
    return scene;
  }

  async updateScene(tenantId: string, actorId: string, id: string, body: any) {
    const scene = await this.db.twinScene.findFirst({ where: { id, tenantId } });
    if (!scene) throw new NotFoundException(`scene not found: ${id}`);
    if (body?.revision != null && body.revision !== scene.revision) {
      throw new ConflictException(`stale revision: sent ${body.revision}, current ${scene.revision}`);
    }
    const data: Record<string, unknown> = { updatedBy: actorId, revision: { increment: 1 } };
    if (body?.name) data.name = body.name;
    if (body?.themeKey) data.themeKey = body.themeKey;
    if (body?.wallHeightMeters != null) data.wallHeightMeters = body.wallHeightMeters;
    if (body?.status) {
      const status = String(body.status).toUpperCase();
      if (!['DRAFT', 'IN_REVIEW', 'ARCHIVED'].includes(status)) {
        throw new BadRequestException(`scene status ${status} cannot be set directly — publish creates PUBLISHED`);
      }
      data.status = status;
    }
    return this.db.twinScene.update({ where: { id }, data: data as any });
  }

  /**
   * Upsert a zone→entity binding. Validates that the zone EXISTS in the plan
   * geometry and, for ORG_UNIT, that the OrgUnit exists IN THIS TENANT — so a
   * binding can never point at another tenant's org unit (AT-001).
   */
  async upsertBinding(tenantId: string, actorId: string, sceneId: string, body: any) {
    const scene = await this.db.twinScene.findFirst({ where: { id: sceneId, tenantId } });
    if (!scene) throw new NotFoundException(`scene not found: ${sceneId}`);
    if (!body?.zoneId) throw new BadRequestException('zoneId is required');
    if (!body?.bindingId) throw new BadRequestException('bindingId is required');
    const bindingType = String(body.bindingType ?? 'ORG_UNIT').toUpperCase();
    if (!(BINDING_TYPES as readonly string[]).includes(bindingType)) {
      throw new BadRequestException(`invalid bindingType ${bindingType}`);
    }
    const plan = await this.db.floorPlanDefinition.findFirst({ where: { id: scene.planId, tenantId } });
    const geometry = validateGeometry(plan?.geometry ?? {});
    if (!geometry.zones.some((z) => z.id === body.zoneId)) {
      throw new BadRequestException(`zone "${body.zoneId}" does not exist in the plan geometry`);
    }
    if (bindingType === 'ORG_UNIT') {
      const org = await this.db.orgUnit.findFirst({ where: { id: body.bindingId, tenantId } });
      if (!org) throw new BadRequestException(`orgUnit not found in this tenant: ${body.bindingId}`);
    }
    if (bindingType === 'PROJECT') {
      const proj = await this.db.executionProject.findFirst({ where: { id: body.bindingId, tenantId } });
      if (!proj) throw new BadRequestException(`project not found in this tenant: ${body.bindingId}`);
    }
    const dataLayerIds: string[] = Array.isArray(body.dataLayerIds) ? body.dataLayerIds : [];
    if (dataLayerIds.length) {
      const found = await this.db.dataLayerDefinition.findMany({ where: { tenantId, id: { in: dataLayerIds } }, select: { id: true } });
      const missing = dataLayerIds.filter((d) => !found.some((f) => f.id === d));
      if (missing.length) throw new BadRequestException(`unknown data layer(s): ${missing.join(', ')}`);
    }
    const existing = await this.db.sceneBinding.findFirst({ where: { tenantId, sceneId, zoneId: body.zoneId } });
    const payload = {
      bindingType,
      bindingId: body.bindingId,
      iconKey: body.iconKey ?? null,
      materialKey: body.materialKey ?? 'status-dynamic',
      dataLayerIds,
    };
    const binding = existing
      ? await this.db.sceneBinding.update({ where: { id: existing.id }, data: payload })
      : await this.db.sceneBinding.create({ data: { tenantId, sceneId, zoneId: body.zoneId, ...payload } });
    await this.audit(tenantId, sceneId, 'scene.bind', actorId, { zoneId: body.zoneId, bindingType, bindingId: body.bindingId });
    return binding;
  }

  async deleteBinding(tenantId: string, actorId: string, sceneId: string, zoneId: string) {
    const res = await this.db.sceneBinding.deleteMany({ where: { tenantId, sceneId, zoneId } });
    await this.audit(tenantId, sceneId, 'scene.unbind', actorId, { zoneId });
    return { deleted: res.count };
  }

  /** Publish an IMMUTABLE TwinSceneVersion freezing geometry + bindings + theme. */
  async publishScene(tenantId: string, actorId: string, sceneId: string, note?: string) {
    const scene = await this.db.twinScene.findFirst({ where: { id: sceneId, tenantId }, include: { bindings: true } });
    if (!scene) throw new NotFoundException(`scene not found: ${sceneId}`);
    const plan = await this.db.floorPlanDefinition.findFirst({ where: { id: scene.planId, tenantId } });
    if (!plan) throw new NotFoundException(`floor plan not found: ${scene.planId}`);
    if (plan.activeVersionNo == null) throw new BadRequestException('publish the floor plan before publishing the scene');
    const planVersion = await this.db.floorPlanVersion.findFirst({
      where: { tenantId, planId: plan.id, versionNo: scene.floorPlanVersionNo ?? plan.activeVersionNo },
    });
    if (!planVersion) throw new BadRequestException('the pinned floor-plan version does not exist');
    if (scene.bindings.length === 0) throw new BadRequestException('cannot publish a scene with no zone bindings');

    const last = await this.db.twinSceneVersion.findFirst({ where: { tenantId, sceneId }, orderBy: { versionNo: 'desc' } });
    const versionNo = (last?.versionNo ?? 0) + 1;
    const payload = {
      sceneId: scene.id,
      name: scene.name,
      floorId: scene.floorId,
      themeKey: scene.themeKey,
      wallHeightMeters: scene.wallHeightMeters,
      versionNo,
      floorPlanVersionId: planVersion.id,
      floorPlanVersionNo: planVersion.versionNo,
      floorPlanChecksum: planVersion.checksum,
      geometry: (planVersion.payload as any)?.zones ? { walls: (planVersion.payload as any).walls ?? [], zones: (planVersion.payload as any).zones } : { walls: [], zones: [] },
      calibration: (planVersion.payload as any)?.calibration ?? { metersPerUnit: 1, originX: 0, originY: 0 },
      bindings: scene.bindings
        .map((b) => ({ zoneId: b.zoneId, bindingType: b.bindingType, bindingId: b.bindingId, iconKey: b.iconKey, materialKey: b.materialKey, dataLayerIds: b.dataLayerIds }))
        .sort((a, b) => a.zoneId.localeCompare(b.zoneId)),
    };
    const checksum = checksumOf(payload);
    await this.db.twinSceneVersion.updateMany({ where: { tenantId, sceneId, status: 'PUBLISHED' }, data: { status: 'SUPERSEDED' } });
    const version = await this.db.twinSceneVersion.create({
      data: { tenantId, sceneId, versionNo, payload: payload as any, checksum, publishedBy: actorId, note: note ?? null },
    });
    await this.db.twinScene.update({ where: { id: sceneId }, data: { status: 'PUBLISHED', activeVersionNo: versionNo, updatedBy: actorId } });
    await this.audit(tenantId, sceneId, 'scene.publish', actorId, { versionNo, checksum, zones: payload.geometry.zones.length });
    return version;
  }

  async listSceneVersions(tenantId: string, sceneId: string) {
    const items = await this.db.twinSceneVersion.findMany({ where: { tenantId, sceneId }, orderBy: { versionNo: 'desc' } });
    return { items, count: items.length };
  }

  async rollbackScene(tenantId: string, actorId: string, sceneId: string, versionNo: number) {
    const scene = await this.db.twinScene.findFirst({ where: { id: sceneId, tenantId } });
    if (!scene) throw new NotFoundException(`scene not found: ${sceneId}`);
    const target = await this.db.twinSceneVersion.findFirst({ where: { tenantId, sceneId, versionNo } });
    if (!target) throw new NotFoundException(`version ${versionNo} not found`);
    await this.db.twinScene.update({ where: { id: sceneId }, data: { activeVersionNo: versionNo, updatedBy: actorId } });
    await this.audit(tenantId, sceneId, 'scene.rollback', actorId, { versionNo });
    const total = await this.db.twinSceneVersion.count({ where: { tenantId, sceneId } });
    return { sceneId, activeVersionNo: versionNo, versionCount: total, deleted: 0 };
  }

  /**
   * The RUNTIME read: the ACTIVE published scene version, resolved with org-unit
   * labels and zone areas. Never returns a draft — the viewer only ever sees
   * published, checksummed geometry.
   */
  async runtimeScene(tenantId: string, sceneId: string) {
    const scene = await this.db.twinScene.findFirst({ where: { id: sceneId, tenantId } });
    if (!scene) throw new NotFoundException(`scene not found: ${sceneId}`);
    if (scene.activeVersionNo == null) throw new NotFoundException(`scene ${sceneId} has no published version`);
    const version = await this.db.twinSceneVersion.findFirst({ where: { tenantId, sceneId, versionNo: scene.activeVersionNo } });
    if (!version) throw new NotFoundException(`active version ${scene.activeVersionNo} missing`);
    const payload = version.payload as any;
    const bindings: any[] = payload.bindings ?? [];
    const orgIds = bindings.filter((b) => b.bindingType === 'ORG_UNIT').map((b) => b.bindingId);
    const orgs = orgIds.length ? await this.db.orgUnit.findMany({ where: { tenantId, id: { in: orgIds } } }) : [];
    const orgMap = new Map(orgs.map((o) => [o.id, o]));
    const geometry: Geometry = { walls: payload.geometry?.walls ?? [], zones: payload.geometry?.zones ?? [] };
    return {
      sceneId: scene.id,
      name: payload.name,
      themeKey: payload.themeKey,
      wallHeightMeters: payload.wallHeightMeters,
      versionNo: version.versionNo,
      checksum: version.checksum,
      publishedAt: version.publishedAt,
      calibration: payload.calibration,
      zones: geometry.zones.map((z) => {
        const b = bindings.find((x) => x.zoneId === z.id);
        const org = b && b.bindingType === 'ORG_UNIT' ? orgMap.get(b.bindingId) : undefined;
        return {
          ...z,
          areaSqM: Number(areaSqMeters(z.polygon).toFixed(2)),
          binding: b ? { bindingType: b.bindingType, bindingId: b.bindingId, iconKey: b.iconKey, materialKey: b.materialKey, dataLayerIds: b.dataLayerIds ?? [] } : null,
          orgUnit: org ? { id: org.id, code: org.code, name: org.name } : null,
        };
      }),
      walls: geometry.walls,
    };
  }

  // ---- icon catalog ----------------------------------------------------------

  async listIcons(tenantId: string) {
    const items = await this.db.iconAsset.findMany({ where: { tenantId, status: 'ACTIVE' }, orderBy: { key: 'asc' } });
    return { items, count: items.length };
  }
}
