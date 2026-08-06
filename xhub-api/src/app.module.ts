import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SeedModule } from './seed/seed.module';
import { PreferencesModule } from './preferences/preferences.module';
import { XofficeModule } from './xoffice/xoffice.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { IdentityModule } from './identity/identity.module';
import { ControlplaneModule } from './controlplane/controlplane.module';
import { MdmModule } from './mdm/mdm.module';
import { BackupModule } from './backup/backup.module';
import { RecordsModule } from './records/records.module';
import { WebhookModule } from './webhook/webhook.module';
import { TestRunsModule } from './testruns/testruns.module';
import { RequestsModule } from './requests/requests.module';
import { DirectivesModule } from './directives/directives.module';
import { TicketsModule } from './tickets/tickets.module';
import { BookingsModule } from './bookings/bookings.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { PlatformModule } from './platform/platform.module';
import { TenantLaunchModule } from './platform/launch/tenant-launch.module';
import { CatalogModule } from './platform/catalog/catalog.module';
import { OnboardingModule } from './platform/onboarding/onboarding.module';
import { DeliveryModule } from './delivery/delivery.module';
import { TenantLifecycleModule } from './platform/lifecycle/tenant-lifecycle.module';
import { WorkModule } from './work/work.module';
import { ManageModule } from './manage/manage.module';
import { IocModule } from './ioc/ioc.module';
import { PeopleModule } from './people/people.module';
import { CustomersModule } from './customers/customers.module';
import { OpportunitiesModule } from './opportunities/opportunities.module';
import { CommercialCatalogModule } from './commercial-catalog/commercial-catalog.module';
import { ProposalsModule } from './proposals/proposals.module';
import { ContractsModule } from './contracts/contracts.module';
import { RevenueKpiModule } from './revenue-kpi/revenue-kpi.module';
import { SupportCasesModule } from './support-cases/support-cases.module';

/**
 * "All-in-one" composition root (boots via `main.ts` / `npm start`).
 *
 * BROKEN for any X.Office business flow that calls into IdentityService,
 * as of Phase 1.5 Stage C (2026-08-04). This module binds
 * `IdentityModule.forPlatform()` (IDENTITY_PRISMA → `PrismaService`, the
 * `xhub` database), but the business modules it also imports (XofficeModule,
 * RequestsModule, TicketsModule, ...) run under
 * `XofficeTenantScopeInterceptor`, which opens its `withTenant`/`withBypass`
 * transaction on the DIFFERENT `XofficePrismaService` instance (the `xoffice`
 * database). Any call from a business route into IdentityService
 * (e.g. `createDelegation`, approver resolution) finds `this.prisma.db`
 * unscoped/undefined on the platform-bound instance and throws.
 *
 * There is no fix that keeps this module correct for BOTH module groups at
 * once — IDENTITY_PRISMA is a single DI token bound once per module tree, and
 * the two groups now live in physically separate databases. Use the real
 * process split instead: `PlatformAppModule` (`npm run start:platform`) for
 * XHUB_PLATFORM routes, `XofficeAppModule` (`npm run start:xoffice`) for
 * XOFFICE_BUSINESS routes. This module is kept only because
 * platform-only routes (controlplane/mdm/backup/webhook/...) still work
 * under it and `test/app.e2e-spec.ts` boots it for a trivial smoke check —
 * do not rely on it for any X.Office flow.
 */
@Module({
  imports: [PrismaModule, AuthModule.forPlatform(), SeedModule, PreferencesModule, IdentityModule.forPlatform(), XofficeModule, ControlplaneModule, MdmModule, BackupModule, RecordsModule, WebhookModule, TestRunsModule, RequestsModule, DirectivesModule, TicketsModule, BookingsModule, AnnouncementsModule, PlatformModule, TenantLaunchModule, CatalogModule, OnboardingModule, DeliveryModule, TenantLifecycleModule, WorkModule, ManageModule, IocModule, PeopleModule, CustomersModule, OpportunitiesModule, CommercialCatalogModule, ProposalsModule, ContractsModule, RevenueKpiModule, SupportCasesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
