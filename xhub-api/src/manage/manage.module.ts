import { Module } from '@nestjs/common';
import { XofficePrismaModule } from '../xoffice-prisma/xoffice-prisma.module';
import { XofficeTenantScopeInterceptor } from '../common/xoffice-tenant-scope.interceptor';
import { ObjectivesService } from './objectives.service';
import { MetricsService } from './metrics.service';
import { ReviewsService } from './reviews.service';
import { DecisionsService } from './decisions.service';
import { ActionsService } from './actions.service';
import { ScorecardsService } from './scorecards.service';
import { OkrService } from './okr.service';
import { KpiTreeService } from './kpi-tree.service';
import { PortfoliosService } from './portfolios.service';
import { InitiativesService } from './initiatives.service';
import { BenefitProfilesService } from './benefit-profiles.service';
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
  PortfoliosController,
  InitiativesController,
  BenefitProfilesController,
} from './manage.controllers';

/**
 * X.Office Management Operating System — MG-01 "reference slice". ONE management
 * loop end-to-end (Objective → Metric+Observation → Review → Decision → Action →
 * linked NativeWorkItem → follow-up), greenfield ALONGSIDE Work v2. Additive:
 * reuses the shared RLS XofficePrismaService + XOffice XofficeTenantScopeInterceptor. Metric
 * observations are COMPUTED from the existing NativeWorkItem data (read model,
 * #12) — no dual-write; the action bridge LINKS to NativeWorkItem (#13).
 */
@Module({
  imports: [XofficePrismaModule],
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
    PortfoliosController,
    InitiativesController,
    BenefitProfilesController,
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
    PortfoliosService,
    InitiativesService,
    BenefitProfilesService,
    XofficeTenantScopeInterceptor,
  ],
  exports: [ObjectivesService, MetricsService, ReviewsService, DecisionsService, ActionsService, ScorecardsService, OkrService, KpiTreeService, PortfoliosService, InitiativesService, BenefitProfilesService],
})
export class ManageModule {}
