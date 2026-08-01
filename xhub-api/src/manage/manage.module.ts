import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantScopeInterceptor } from '../xoffice/tenant-scope.interceptor';
import { ObjectivesService } from './objectives.service';
import { MetricsService } from './metrics.service';
import { ReviewsService } from './reviews.service';
import { DecisionsService } from './decisions.service';
import { ActionsService } from './actions.service';
import { ScorecardsService } from './scorecards.service';
import { OkrService } from './okr.service';
import { KpiTreeService } from './kpi-tree.service';
import {
  ObjectivesController,
  MetricsController,
  ReviewsController,
  DecisionsController,
  ActionsController,
  ScorecardsController,
  OkrCyclesController,
  OkrsController,
  KpiTreeController,
} from './manage.controllers';

/**
 * X.Office Management Operating System — MG-01 "reference slice". ONE management
 * loop end-to-end (Objective → Metric+Observation → Review → Decision → Action →
 * linked NativeWorkItem → follow-up), greenfield ALONGSIDE Work v2. Additive:
 * reuses the shared RLS PrismaService + XOffice TenantScopeInterceptor. Metric
 * observations are COMPUTED from the existing NativeWorkItem data (read model,
 * #12) — no dual-write; the action bridge LINKS to NativeWorkItem (#13).
 */
@Module({
  imports: [PrismaModule],
  controllers: [
    ObjectivesController,
    MetricsController,
    ReviewsController,
    DecisionsController,
    ActionsController,
    ScorecardsController,
    OkrCyclesController,
    OkrsController,
    KpiTreeController,
  ],
  providers: [
    ObjectivesService,
    MetricsService,
    ReviewsService,
    DecisionsService,
    ActionsService,
    ScorecardsService,
    OkrService,
    KpiTreeService,
    TenantScopeInterceptor,
  ],
  exports: [ObjectivesService, MetricsService, ReviewsService, DecisionsService, ActionsService, ScorecardsService, OkrService, KpiTreeService],
})
export class ManageModule {}
