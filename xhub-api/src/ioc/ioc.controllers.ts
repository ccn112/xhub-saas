import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseInterceptors } from '@nestjs/common';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';
import { IdentityService } from '../identity/identity.service';
import { TwinStudioService } from './twin-studio.service';
import { DataLayerService } from './data-layer.service';
import { DashboardService } from './dashboard.service';
import { IocTemplateService } from './ioc-template.service';
import { IocInsightsService } from './insights.service';

/**
 * XHub Enterprise IOC — HTTP surface. All routes under /api/ioc/*, tenant-scoped
 * via XofficeTenantScopeInterceptor (withTenant → RLS), permission-gated through the
 * global PermissionGuard (no-op unless AUTH_ENFORCE). Thin controllers — all
 * logic lives in the services.
 *
 * Permission map (ADR-0004): ioc.view / ioc.studio.read / ioc.studio.write /
 * ioc.studio.publish / ioc.datalayer.manage / ioc.people.detail.
 */
function tenant(id: RequestIdentity): string {
  return id.tenantId ?? 'tenant-xtech';
}
function user(id: RequestIdentity): string {
  return id.userId ?? 'user-nam';
}

/**
 * Resolve the caller's effective permissions for the privacy gate. Under
 * enforcement this is the real RBAC answer; when NOT enforcing we still ask the
 * engine (rather than assuming yes), so an individual drill-down is refused for
 * a caller who genuinely lacks ioc.people.detail even in the demo.
 */
async function heldPermissions(identity: IdentityService, id: RequestIdentity): Promise<string[]> {
  try {
    const res = await identity.can(user(id), 'ioc.people.detail');
    return res.allowed ? ['ioc.people.detail'] : [];
  } catch {
    return [];
  }
}

// ---- Twin Studio: sites / floors / plans ------------------------------------

@Controller('api/ioc/sites')
@UseInterceptors(XofficeTenantScopeInterceptor)
export class IocSitesController {
  constructor(private readonly svc: TwinStudioService) {}

  @Get()
  @RequirePermission('ioc.studio.read')
  list(@Identity() id: RequestIdentity) {
    return this.svc.listSites(tenant(id));
  }

  @Post()
  @RequirePermission('ioc.studio.write')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.createSite(tenant(id), user(id), body ?? {});
  }

  @Post('floors')
  @RequirePermission('ioc.studio.write')
  createFloor(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.createFloor(tenant(id), user(id), body ?? {});
  }
}

@Controller('api/ioc/floor-plans')
@UseInterceptors(XofficeTenantScopeInterceptor)
export class IocFloorPlansController {
  constructor(private readonly svc: TwinStudioService) {}

  @Get()
  @RequirePermission('ioc.studio.read')
  list(@Identity() id: RequestIdentity, @Query('floorId') floorId?: string) {
    return this.svc.listPlans(tenant(id), { floorId });
  }

  @Get(':id')
  @RequirePermission('ioc.studio.read')
  get(@Param('id') pid: string, @Identity() id: RequestIdentity) {
    return this.svc.getPlan(tenant(id), pid);
  }

  @Post()
  @RequirePermission('ioc.studio.write')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.createPlan(tenant(id), user(id), body ?? {});
  }

  /** Autosave the draft geometry (optimistic `revision`). */
  @Patch(':id')
  @RequirePermission('ioc.studio.write')
  update(@Param('id') pid: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.updatePlan(tenant(id), user(id), pid, body ?? {});
  }

  @Post(':id/publish')
  @RequirePermission('ioc.studio.publish')
  publish(@Param('id') pid: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.publishPlan(tenant(id), user(id), pid, body?.note);
  }

  @Get(':id/versions')
  @RequirePermission('ioc.studio.read')
  versions(@Param('id') pid: string, @Identity() id: RequestIdentity) {
    return this.svc.listPlanVersions(tenant(id), pid);
  }

  @Post(':id/rollback')
  @RequirePermission('ioc.studio.publish')
  rollback(@Param('id') pid: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.rollbackPlan(tenant(id), user(id), pid, Number(body?.versionNo));
  }
}

// ---- Twin Studio: scenes ----------------------------------------------------

@Controller('api/ioc/scenes')
@UseInterceptors(XofficeTenantScopeInterceptor)
export class IocScenesController {
  constructor(private readonly svc: TwinStudioService) {}

  @Get()
  @RequirePermission('ioc.studio.read')
  list(@Identity() id: RequestIdentity) {
    return this.svc.listScenes(tenant(id));
  }

  @Get(':id')
  @RequirePermission('ioc.studio.read')
  get(@Param('id') sid: string, @Identity() id: RequestIdentity) {
    return this.svc.getScene(tenant(id), sid);
  }

  @Post()
  @RequirePermission('ioc.studio.write')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.createScene(tenant(id), user(id), body ?? {});
  }

  @Patch(':id')
  @RequirePermission('ioc.studio.write')
  update(@Param('id') sid: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.updateScene(tenant(id), user(id), sid, body ?? {});
  }

  @Post(':id/bindings')
  @RequirePermission('ioc.studio.write')
  bind(@Param('id') sid: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.upsertBinding(tenant(id), user(id), sid, body ?? {});
  }

  @Delete(':id/bindings/:zoneId')
  @RequirePermission('ioc.studio.write')
  unbind(@Param('id') sid: string, @Param('zoneId') zoneId: string, @Identity() id: RequestIdentity) {
    return this.svc.deleteBinding(tenant(id), user(id), sid, zoneId);
  }

  @Post(':id/publish')
  @RequirePermission('ioc.studio.publish')
  publish(@Param('id') sid: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.publishScene(tenant(id), user(id), sid, body?.note);
  }

  @Get(':id/versions')
  @RequirePermission('ioc.studio.read')
  versions(@Param('id') sid: string, @Identity() id: RequestIdentity) {
    return this.svc.listSceneVersions(tenant(id), sid);
  }

  @Post(':id/rollback')
  @RequirePermission('ioc.studio.publish')
  rollback(@Param('id') sid: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.rollbackScene(tenant(id), user(id), sid, Number(body?.versionNo));
  }

  /** RUNTIME read — the ACTIVE published version only, never a draft. */
  @Get(':id/runtime')
  @RequirePermission('ioc.view')
  runtime(@Param('id') sid: string, @Identity() id: RequestIdentity) {
    return this.svc.runtimeScene(tenant(id), sid);
  }
}

// ---- Template gallery + clone-to-edit (DT-04) -------------------------------

/**
 * The SHARED twin-template catalog. Reads are a platform catalog read (the rows
 * carry no tenant data at all — same posture as the Blueprint catalog), gated by
 * `ioc.studio.read` so any studio user can browse. The CLONE writes only into
 * the caller's own tenant through the RLS transaction, so it needs
 * `ioc.studio.write`.
 */
@Controller('api/ioc/templates')
@UseInterceptors(XofficeTenantScopeInterceptor)
export class IocTemplatesController {
  constructor(private readonly svc: IocTemplateService) {}

  @Get()
  @RequirePermission('ioc.studio.read')
  list(@Query('industry') industry?: string, @Query('twinType') twinType?: string, @Query('status') status?: string) {
    return this.svc.list({ industry, twinType, status });
  }

  @Get(':id')
  @RequirePermission('ioc.studio.read')
  get(@Param('id') tid: string) {
    return this.svc.get(tid);
  }

  /** Nhân bản: materialise the template as a NEW draft owned by THIS tenant. */
  @Post(':id/clone')
  @RequirePermission('ioc.studio.write')
  clone(@Param('id') tid: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.clone(tenant(id), user(id), tid, body ?? {});
  }
}

@Controller('api/ioc/icons')
@UseInterceptors(XofficeTenantScopeInterceptor)
export class IocIconsController {
  constructor(private readonly svc: TwinStudioService) {}

  @Get()
  @RequirePermission('ioc.studio.read')
  list(@Identity() id: RequestIdentity) {
    return this.svc.listIcons(tenant(id));
  }
}

// ---- Data layers ------------------------------------------------------------

@Controller('api/ioc/data-layers')
@UseInterceptors(XofficeTenantScopeInterceptor)
export class IocDataLayersController {
  constructor(
    private readonly svc: DataLayerService,
    private readonly identity: IdentityService,
  ) {}

  /** The COMPILED catalog — the only vocabulary the query builder may use. */
  @Get('catalog')
  @RequirePermission('ioc.studio.read')
  catalog() {
    return this.svc.catalog();
  }

  @Get()
  @RequirePermission('ioc.studio.read')
  list(@Identity() id: RequestIdentity, @Query('entityKey') entityKey?: string) {
    return this.svc.list(tenant(id), { entityKey });
  }

  @Get(':id')
  @RequirePermission('ioc.studio.read')
  get(@Param('id') did: string, @Identity() id: RequestIdentity) {
    return this.svc.get(tenant(id), did);
  }

  @Post()
  @RequirePermission('ioc.datalayer.manage')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(tenant(id), user(id), body ?? {});
  }

  @Patch(':id')
  @RequirePermission('ioc.datalayer.manage')
  update(@Param('id') did: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.update(tenant(id), user(id), did, body ?? {});
  }

  /** Ad-hoc validation + preview of an UNSAVED definition (nothing persisted). */
  @Post('preview')
  @RequirePermission('ioc.datalayer.manage')
  async preview(@Body() body: any, @Identity() id: RequestIdentity) {
    const permissions = await heldPermissions(this.identity, id);
    return this.svc.preview(tenant(id), user(id), body ?? {}, { scope: body?.scope, permissions });
  }

  /**
   * Execute a saved layer. `scope=individual` is refused unless the caller holds
   * ioc.people.detail, and is audited when allowed (Constitution #7 / AT-006).
   */
  @Get(':id/execute')
  @RequirePermission('ioc.view')
  async execute(@Param('id') did: string, @Identity() id: RequestIdentity, @Query('scope') scope?: string) {
    const permissions = await heldPermissions(this.identity, id);
    return this.svc.execute(tenant(id), user(id), did, {
      scope: scope === 'individual' ? 'individual' : 'aggregate',
      permissions,
    });
  }
}

// ---- Dashboards + IOC runtime ----------------------------------------------

@Controller('api/ioc/dashboards')
@UseInterceptors(XofficeTenantScopeInterceptor)
export class IocDashboardsController {
  constructor(private readonly svc: DashboardService) {}

  @Get()
  @RequirePermission('ioc.view')
  list(@Identity() id: RequestIdentity) {
    return this.svc.list(tenant(id));
  }

  @Get(':id')
  @RequirePermission('ioc.studio.read')
  get(@Param('id') did: string, @Identity() id: RequestIdentity) {
    return this.svc.get(tenant(id), did);
  }

  @Post()
  @RequirePermission('ioc.studio.write')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(tenant(id), user(id), body ?? {});
  }

  @Patch(':id')
  @RequirePermission('ioc.studio.write')
  update(@Param('id') did: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.update(tenant(id), user(id), did, body ?? {});
  }

  @Post(':id/publish')
  @RequirePermission('ioc.studio.publish')
  publish(@Param('id') did: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.publish(tenant(id), user(id), did, body?.note);
  }

  @Get(':id/versions')
  @RequirePermission('ioc.studio.read')
  versions(@Param('id') did: string, @Identity() id: RequestIdentity) {
    return this.svc.listVersions(tenant(id), did);
  }

  @Post(':id/rollback')
  @RequirePermission('ioc.studio.publish')
  rollback(@Param('id') did: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.rollback(tenant(id), user(id), did, Number(body?.versionNo));
  }
}

@Controller('api/ioc/runtime')
@UseInterceptors(XofficeTenantScopeInterceptor)
export class IocRuntimeController {
  constructor(
    private readonly svc: DashboardService,
    private readonly insights: IocInsightsService,
    private readonly identity: IdentityService,
  ) {}

  /** Resolve a PUBLISHED dashboard (by code or id) with its scene + live layers. */
  @Get('dashboards/:codeOrId')
  @RequirePermission('ioc.view')
  async dashboard(@Param('codeOrId') codeOrId: string, @Identity() id: RequestIdentity) {
    const permissions = await heldPermissions(this.identity, id);
    return this.svc.runtime(tenant(id), user(id), codeOrId, { permissions });
  }

  /**
   * Command-centre INSIGHTS for the same published dashboard (DT-05): real
   * cross-zone flow volume, the derived health score, the pipeline/alert feeds
   * and the draft-first AI brief. Read-only projection — same `ioc.view` gate,
   * same aggregate-only posture (never individual rows).
   */
  @Get('dashboards/:codeOrId/insights')
  @RequirePermission('ioc.view')
  async dashboardInsights(@Param('codeOrId') codeOrId: string, @Identity() id: RequestIdentity) {
    const permissions = await heldPermissions(this.identity, id);
    return this.insights.insights(tenant(id), user(id), codeOrId, { permissions });
  }

  /**
   * Zone drill-down (DT-06): roster + open tasks + zone-scoped alerts for ONE
   * zone the caller clicked on the twin. Individual-level data — refused
   * (service-side) unless the caller holds ioc.people.detail, and audited when
   * allowed. Same `ioc.view` gate at the route as the rest of runtime; the
   * finer individual-data check happens in the service (matches
   * IocDataLayersController.execute's scope=individual convention).
   */
  @Get('dashboards/:codeOrId/zones/:zoneId/drilldown')
  @RequirePermission('ioc.view')
  async zoneDrilldown(@Param('codeOrId') codeOrId: string, @Param('zoneId') zoneId: string, @Identity() id: RequestIdentity) {
    const permissions = await heldPermissions(this.identity, id);
    return this.insights.zoneDrilldown(tenant(id), user(id), codeOrId, zoneId, { permissions });
  }
}
