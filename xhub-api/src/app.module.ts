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

@Module({
  imports: [PrismaModule, AuthModule, SeedModule, PreferencesModule, IdentityModule, XofficeModule, ControlplaneModule, MdmModule, BackupModule, RecordsModule, WebhookModule, TestRunsModule, RequestsModule, DirectivesModule, TicketsModule, BookingsModule, AnnouncementsModule, PlatformModule, TenantLaunchModule, CatalogModule, OnboardingModule, DeliveryModule, TenantLifecycleModule, WorkModule, ManageModule, IocModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
