import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { SeedModule } from './seed/seed.module';
import { IdentityModule } from './identity/identity.module';
import { PreferencesModule } from './preferences/preferences.module';
import { TestRunsModule } from './testruns/testruns.module';
import { XofficeModule } from './xoffice/xoffice.module';
import { RecordsModule } from './records/records.module';
import { RequestsModule } from './requests/requests.module';
import { DirectivesModule } from './directives/directives.module';
import { TicketsModule } from './tickets/tickets.module';
import { BookingsModule } from './bookings/bookings.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { DeliveryModule } from './delivery/delivery.module';
import { WorkModule } from './work/work.module';
import { ManageModule } from './manage/manage.module';
import { IocModule } from './ioc/ioc.module';
import { PeopleModule } from './people/people.module';
import { IdentitySyncModule } from './identity-sync/identity-sync.module';
import { CustomersModule } from './customers/customers.module';
import { OpportunitiesModule } from './opportunities/opportunities.module';
import { CommercialCatalogModule } from './commercial-catalog/commercial-catalog.module';
import { ProposalsModule } from './proposals/proposals.module';
import { ContractsModule } from './contracts/contracts.module';
import { RevenueKpiModule } from './revenue-kpi/revenue-kpi.module';

/**
 * X.Office process — Phase 1.5 Stage B composition root. Carries the
 * XOFFICE_BUSINESS module group (workflow engine, requests/directives/
 * tickets/bookings/announcements, records, delivery, work, manage, ioc,
 * people) plus the SHARED library modules (auth/seed/identity — no direct
 * `PrismaModule` import: nothing here needs the Platform database anymore,
 * see auth.module.ts's Stage C follow-up note) every process needs for its
 * own guards + tenant/identity resolution. Also carries
 * the two small AMBIGUOUS modules (preferences, testruns) — low-stakes,
 * revisit placement if it turns out wrong. Boots via `main-xoffice.ts`. See
 * docs/implementation/xoffice-ai/IMPLEMENTATION_PLAN.md Phase 1.5 Stage B for
 * the module classification this mirrors.
 */
@Module({
  imports: [
    AuthModule.forXoffice(),
    SeedModule,
    IdentityModule.forXoffice(),
    PreferencesModule,
    TestRunsModule,
    XofficeModule,
    RecordsModule,
    RequestsModule,
    DirectivesModule,
    TicketsModule,
    BookingsModule,
    AnnouncementsModule,
    DeliveryModule,
    WorkModule,
    ManageModule,
    IocModule,
    PeopleModule,
    IdentitySyncModule,
    CustomersModule,
    OpportunitiesModule,
    CommercialCatalogModule,
    ProposalsModule,
    ContractsModule,
    RevenueKpiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class XofficeAppModule {}
