import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IdentityModule } from '../identity/identity.module';
import { TenantScopeInterceptor } from '../xoffice/tenant-scope.interceptor';
import { TwinStudioService } from './twin-studio.service';
import { DataLayerService } from './data-layer.service';
import { DashboardService } from './dashboard.service';
import {
  IocSitesController,
  IocFloorPlansController,
  IocScenesController,
  IocIconsController,
  IocDataLayersController,
  IocDashboardsController,
  IocRuntimeController,
} from './ioc.controllers';

/**
 * XHub Enterprise IOC — Digital Twin (DT-01 → DT-03).
 *
 * A PROJECTION product slice, additive alongside Work v2 and the Management OS.
 * It owns scene/dashboard CONFIGURATION only; every number it shows is read from
 * an existing System of Record (NativeWorkItem, ExecutionProject, Position,
 * MetricObservation) through the compiled governed catalog. No dual-write, no
 * new business SoR, no direct DB access from the frontend.
 *
 * Reuses the shared RLS PrismaService + the XOffice TenantScopeInterceptor, and
 * IdentityService for the privacy gate on individual drill-down.
 */
@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [
    IocSitesController,
    IocFloorPlansController,
    IocScenesController,
    IocIconsController,
    IocDataLayersController,
    IocDashboardsController,
    IocRuntimeController,
  ],
  providers: [TwinStudioService, DataLayerService, DashboardService, TenantScopeInterceptor],
  exports: [TwinStudioService, DataLayerService, DashboardService],
})
export class IocModule {}
