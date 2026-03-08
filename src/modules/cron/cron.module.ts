// src/modules/cron/cron.module.ts
import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [NotificationsModule, AnalyticsModule],
  providers: [CronService],
})
export class CronModule {}
