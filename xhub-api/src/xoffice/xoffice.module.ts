import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { XofficeService } from './xoffice.service';
import { XofficeController } from './xoffice.controller';
import { NotificationService } from './notification.service';
import { SchedulerService } from './scheduler.service';
import { TenantScopeInterceptor } from './tenant-scope.interceptor';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [ScheduleModule.forRoot(), IdentityModule],
  providers: [XofficeService, NotificationService, SchedulerService, TenantScopeInterceptor],
  controllers: [XofficeController],
  exports: [XofficeService],
})
export class XofficeModule {}
