import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { OutboxDispatcher } from './webhook.dispatcher';
import { TenantScopeInterceptor } from '../xoffice/tenant-scope.interceptor';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Webhook inbound + transactional outbox + reconciliation (Mục 8b). Additive.
 * ScheduleModule powers the OutboxDispatcher sweep (mirrors the xoffice
 * scheduler). ScheduleModule.forRoot() is idempotent across modules.
 */
@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule],
  controllers: [WebhookController],
  providers: [WebhookService, OutboxDispatcher, TenantScopeInterceptor],
  exports: [WebhookService],
})
export class WebhookModule {}
