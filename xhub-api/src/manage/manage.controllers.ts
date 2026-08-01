import { Body, Controller, Get, Param, Patch, Post, Query, UseInterceptors } from '@nestjs/common';
import { RequirePermission } from '../auth/require-permission.decorator';
import { Identity } from '../auth/identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { TenantScopeInterceptor } from '../xoffice/tenant-scope.interceptor';
import { ObjectivesService } from './objectives.service';
import { MetricsService } from './metrics.service';
import { ReviewsService } from './reviews.service';
import { DecisionsService } from './decisions.service';
import { ActionsService } from './actions.service';
import { ScorecardsService } from './scorecards.service';
import { OkrService } from './okr.service';
import { KpiTreeService } from './kpi-tree.service';

/**
 * X.Office Management Operating System — MG-01 reference slice API. All routes
 * under /api/manage/*, tenant-scoped via TenantScopeInterceptor (withTenant →
 * RLS), permission-gated through the global PermissionGuard (no-op unless
 * AUTH_ENFORCE). Thin controllers — logic lives in the services.
 */
function tenant(id: RequestIdentity): string {
  return id.tenantId ?? 'tenant-xtech';
}
function user(id: RequestIdentity): string {
  return id.userId ?? 'user-nam';
}

@Controller('api/manage/objectives')
@UseInterceptors(TenantScopeInterceptor)
export class ObjectivesController {
  constructor(private readonly svc: ObjectivesService) {}

  @Get()
  @RequirePermission('manage.objective.read')
  list(@Identity() id: RequestIdentity, @Query('status') status?: string, @Query('ownerId') ownerId?: string) {
    return this.svc.list(tenant(id), { status, ownerId });
  }

  @Get(':id')
  @RequirePermission('manage.objective.read')
  get(@Param('id') oid: string, @Identity() id: RequestIdentity) {
    return this.svc.get(tenant(id), oid);
  }

  @Post()
  @RequirePermission('manage.objective.write')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(tenant(id), user(id), body ?? {});
  }

  @Patch(':id')
  @RequirePermission('manage.objective.write')
  update(@Param('id') oid: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.update(tenant(id), user(id), oid, body ?? {});
  }
}

@Controller('api/manage/metrics')
@UseInterceptors(TenantScopeInterceptor)
export class MetricsController {
  constructor(private readonly svc: MetricsService) {}

  @Get()
  @RequirePermission('manage.metric.read')
  list(@Identity() id: RequestIdentity, @Query('sourceSystem') sourceSystem?: string) {
    return this.svc.list(tenant(id), { sourceSystem });
  }

  @Get(':id')
  @RequirePermission('manage.metric.read')
  get(@Param('id') mid: string, @Identity() id: RequestIdentity) {
    return this.svc.get(tenant(id), mid);
  }

  @Post()
  @RequirePermission('manage.metric.write')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(tenant(id), user(id), body ?? {});
  }

  /** Trigger compute (for XOFFICE_WORK) + read the observation series. */
  @Get(':id/observations')
  @RequirePermission('manage.metric.read')
  observations(@Param('id') mid: string, @Identity() id: RequestIdentity, @Query('compute') compute?: string) {
    return this.svc.observations(tenant(id), mid, { compute: compute !== 'false' });
  }
}

@Controller('api/manage/reviews')
@UseInterceptors(TenantScopeInterceptor)
export class ReviewsController {
  constructor(private readonly svc: ReviewsService) {}

  @Get()
  @RequirePermission('manage.review.read')
  list(@Identity() id: RequestIdentity, @Query('status') status?: string, @Query('type') type?: string) {
    return this.svc.list(tenant(id), { status, type });
  }

  @Get(':id')
  @RequirePermission('manage.review.read')
  get(@Param('id') rid: string, @Identity() id: RequestIdentity) {
    return this.svc.get(tenant(id), rid);
  }

  @Post()
  @RequirePermission('manage.review.write')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(tenant(id), user(id), body ?? {});
  }

  @Post(':id/close')
  @RequirePermission('manage.review.write')
  close(@Param('id') rid: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.close(tenant(id), user(id), rid, body ?? {});
  }
}

@Controller('api/manage/decisions')
@UseInterceptors(TenantScopeInterceptor)
export class DecisionsController {
  constructor(private readonly svc: DecisionsService) {}

  @Get()
  @RequirePermission('manage.decision.read')
  list(@Identity() id: RequestIdentity, @Query('status') status?: string, @Query('reviewId') reviewId?: string) {
    return this.svc.list(tenant(id), { status, reviewId });
  }

  @Get(':id')
  @RequirePermission('manage.decision.read')
  get(@Param('id') did: string, @Identity() id: RequestIdentity) {
    return this.svc.get(tenant(id), did);
  }

  @Post()
  @RequirePermission('manage.decision.write')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(tenant(id), user(id), body ?? {});
  }

  @Patch(':id')
  @RequirePermission('manage.decision.write')
  update(@Param('id') did: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.update(tenant(id), user(id), did, body ?? {});
  }
}

@Controller('api/manage/actions')
@UseInterceptors(TenantScopeInterceptor)
export class ActionsController {
  constructor(private readonly svc: ActionsService) {}

  @Get()
  @RequirePermission('manage.action.read')
  list(
    @Identity() id: RequestIdentity,
    @Query('status') status?: string,
    @Query('decisionId') decisionId?: string,
    @Query('reviewId') reviewId?: string,
  ) {
    return this.svc.list(tenant(id), { status, decisionId, reviewId });
  }

  @Get(':id')
  @RequirePermission('manage.action.read')
  get(@Param('id') aid: string, @Identity() id: RequestIdentity) {
    return this.svc.get(tenant(id), aid);
  }

  /** Create an action; spawns/links a real NativeWorkItem (the bridge). */
  @Post()
  @RequirePermission('manage.action.write')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(tenant(id), user(id), body ?? {});
  }
}

@Controller('api/manage/scorecards')
@UseInterceptors(TenantScopeInterceptor)
export class ScorecardsController {
  constructor(private readonly svc: ScorecardsService) {}

  @Get()
  @RequirePermission('manage.scorecard.read')
  list(@Identity() id: RequestIdentity, @Query('period') period?: string) {
    return this.svc.list(tenant(id), { period });
  }

  @Get(':id')
  @RequirePermission('manage.scorecard.read')
  get(@Param('id') sid: string, @Identity() id: RequestIdentity) {
    return this.svc.get(tenant(id), sid);
  }

  @Post()
  @RequirePermission('manage.scorecard.write')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(tenant(id), user(id), body ?? {});
  }

  @Patch(':id')
  @RequirePermission('manage.scorecard.write')
  update(@Param('id') sid: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.update(tenant(id), user(id), sid, body ?? {});
  }
}

@Controller('api/manage/okr-cycles')
@UseInterceptors(TenantScopeInterceptor)
export class OkrCyclesController {
  constructor(private readonly svc: OkrService) {}

  @Get()
  @RequirePermission('manage.okr.read')
  list(@Identity() id: RequestIdentity) {
    return this.svc.listCycles(tenant(id));
  }

  @Post()
  @RequirePermission('manage.okr.write')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.createCycle(tenant(id), user(id), body ?? {});
  }
}

@Controller('api/manage/okrs')
@UseInterceptors(TenantScopeInterceptor)
export class OkrsController {
  constructor(private readonly svc: OkrService) {}

  @Get()
  @RequirePermission('manage.okr.read')
  list(@Identity() id: RequestIdentity, @Query('cycleId') cycleId?: string) {
    return this.svc.list(tenant(id), { cycleId });
  }

  @Get(':id')
  @RequirePermission('manage.okr.read')
  get(@Param('id') oid: string, @Identity() id: RequestIdentity) {
    return this.svc.get(tenant(id), oid);
  }

  @Post()
  @RequirePermission('manage.okr.write')
  create(@Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.create(tenant(id), user(id), body ?? {});
  }

  @Patch(':id')
  @RequirePermission('manage.okr.write')
  update(@Param('id') oid: string, @Body() body: any, @Identity() id: RequestIdentity) {
    return this.svc.update(tenant(id), user(id), oid, body ?? {});
  }

  /** Append-only check-in on a KeyResult (no update/delete route exists — #15). */
  @Post(':id/key-results/:krId/checkin')
  @RequirePermission('manage.okr.write')
  checkIn(
    @Param('id') oid: string,
    @Param('krId') krId: string,
    @Body() body: any,
    @Identity() id: RequestIdentity,
  ) {
    return this.svc.checkIn(tenant(id), user(id), oid, krId, body ?? {});
  }
}

@Controller('api/manage/kpis')
@UseInterceptors(TenantScopeInterceptor)
export class KpiTreeController {
  constructor(private readonly svc: KpiTreeService) {}

  @Get()
  @RequirePermission('manage.metric.read')
  tree(@Identity() id: RequestIdentity, @Query('objectiveId') objectiveId?: string) {
    return this.svc.tree(tenant(id), { objectiveId });
  }

  @Get(':metricCode/series')
  @RequirePermission('manage.metric.read')
  series(@Param('metricCode') metricCode: string, @Identity() id: RequestIdentity) {
    return this.svc.series(tenant(id), metricCode);
  }
}
