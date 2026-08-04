import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
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

/**
 * X.Office process — Phase 1.5 Stage B composition root. Carries the
 * XOFFICE_BUSINESS module group (workflow engine, requests/directives/
 * tickets/bookings/announcements, records, delivery, work, manage, ioc,
 * people) plus the SHARED library modules (prisma/auth/seed/identity) every
 * process needs for its own guards + tenant/identity resolution. Also carries
 * the two small AMBIGUOUS modules (preferences, testruns) — low-stakes,
 * revisit placement if it turns out wrong. Boots via `main-xoffice.ts`. See
 * docs/implementation/xoffice-ai/IMPLEMENTATION_PLAN.md Phase 1.5 Stage B for
 * the module classification this mirrors.
 */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    SeedModule,
    IdentityModule,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class XofficeAppModule {}
