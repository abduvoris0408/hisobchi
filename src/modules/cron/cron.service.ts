// src/modules/cron/cron.service.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AppLogger } from '../../common/logger/logger.service';

@Injectable()
export class CronService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private analytics: AnalyticsService,
    private logger: AppLogger,
  ) {}

  // Har kun kechqurun 21:00 Toshkent vaqti
  @Cron('0 21 * * *', { name: 'daily-reminder', timeZone: 'Asia/Tashkent' })
  async sendDailyReminders() {
    this.logger.log('Kunlik eslatmalar...', 'CronService');

    // Prisma nested where: { notifSettings: { is: { ... } } }
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        fcmToken: { not: null },
        notifSettings: { is: { dailyReminder: true, pushEnabled: true } },
      },
      select: { id: true },
    });

    let sent = 0;
    for (const user of users) {
      try { await this.notifications.sendDailyReminder(user.id); sent++; }
      catch (e: any) { this.logger.error('Daily reminder xatosi', e?.message, 'CronService'); }
    }
    this.logger.log(`✅ Kunlik eslatma: ${sent}/${users.length}`, 'CronService');
  }

  // Har dushanba 09:00
  @Cron('0 9 * * 1', { name: 'weekly-report', timeZone: 'Asia/Tashkent' })
  async sendWeeklyReports() {
    this.logger.log('Haftalik hisobotlar...', 'CronService');
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        notifSettings: { is: { weeklyReport: true, pushEnabled: true } },
      },
      select: { id: true },
    });

    let sent = 0;
    for (const user of users) {
      try {
        const summary = await this.analytics.getMonthlySummary(user.id, month, year);
        const { totalExpense, totalIncome } = summary.data;
        if (totalExpense > 0 || totalIncome > 0) {
          await this.notifications.sendWeeklyReport(user.id, totalExpense, totalIncome);
          sent++;
        }
      } catch (e: any) { this.logger.error('Weekly report xatosi', e?.message, 'CronService'); }
    }
    this.logger.log(`✅ Haftalik hisobot: ${sent}/${users.length}`, 'CronService');
  }

  // Har kun yarim kechasi — 30 kundan eski o'qilgan notiflarni tozalash
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'cleanup-notifications' })
  async cleanupOldNotifications() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const result = await this.prisma.notification.deleteMany({
      where: { isRead: true, createdAt: { lt: thirtyDaysAgo } },
    });
    if (result.count > 0) {
      this.logger.log(`🧹 ${result.count} ta eski bildirishnoma o'chirildi`, 'CronService');
    }
  }
}
