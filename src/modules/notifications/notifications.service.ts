// src/modules/notifications/notifications.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { AppLogger } from '../../common/logger/logger.service';
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private logger: AppLogger,
  ) {}

  private firebaseInitialized = false;

  onModuleInit() {
    const projectId = this.config.get('FIREBASE_PROJECT_ID');
    if (!projectId) {
      this.logger.warn('Firebase sozlanmagan — push ishlamaydi', 'NotificationsService');
      return;
    }
    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            privateKey: this.config.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
            clientEmail: this.config.get('FIREBASE_CLIENT_EMAIL'),
          }),
        });
      }
      this.firebaseInitialized = true;
      this.logger.log('✅ Firebase FCM tayyor', 'NotificationsService');
    } catch (e: any) {
      this.logger.error('Firebase init xatosi', e?.message, 'NotificationsService');
    }
  }

  private async sendPush(fcmToken: string, title: string, body: string, data?: Record<string, string>): Promise<void> {
    if (!this.firebaseInitialized || !fcmToken) return;
    try {
      await admin.messaging().send({
        token: fcmToken,
        notification: { title, body },
        data: data ?? {},
        android: { notification: { sound: 'default', channelId: 'hisobchi_main' } },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      });
    } catch (e: any) {
      this.logger.error('FCM push xatosi', e?.message, 'NotificationsService');
    }
  }

  async send(userId: string, title: string, body: string, type: NotificationType, data?: Record<string, any>): Promise<void> {
    await this.prisma.notification.create({ data: { userId, title, body, type, data } });

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { fcmToken: true } });
    if (user?.fcmToken) {
      await this.sendPush(
        user.fcmToken, title, body,
        data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : undefined,
      );
    }
  }

  async sendBudgetAlert(userId: string, categoryName: string, percentage: number, isExceeded: boolean) {
    const title = isExceeded ? '⚠️ Byudjet oshib ketdi!' : '📊 Byudjet ogohlantirishи';
    const body = isExceeded
      ? `${categoryName} byudjeti ${percentage}% dan oshdi`
      : `${categoryName} byudjetining ${percentage}% sarflandi`;
    await this.send(userId, title, body,
      isExceeded ? NotificationType.BUDGET_EXCEEDED : NotificationType.BUDGET_ALERT,
      { categoryName, percentage: String(percentage) },
    );
  }

  async sendDailyReminder(userId: string) {
    await this.send(userId, '📝 Bugungi xarajatlarni kiriting', "Hisobchi: bugungi xarajatlaringizni unutmang!", NotificationType.DAILY_REMINDER);
  }

  async sendWeeklyReport(userId: string, totalExpense: number, totalIncome: number) {
    const balance = totalIncome - totalExpense;
    const sign = balance >= 0 ? '+' : '';
    await this.send(
      userId, '📊 Haftalik hisobot tayyor',
      `Xarajat: ${totalExpense.toLocaleString()} | Daromad: ${totalIncome.toLocaleString()} | ${sign}${balance.toLocaleString()} so'm`,
      NotificationType.WEEKLY_REPORT,
    );
  }

  async findAll(userId: string, page = 1, limit = 20) {
    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    return { data: notifications, meta: { total, page, limit, totalPages: Math.ceil(total / limit), unreadCount } };
  }

  async markAsRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true, readAt: new Date() } });
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true, readAt: new Date() } });
    return { message: "Barcha bildirishnomalar o'qildi deb belgilandi" };
  }

  async registerToken(userId: string, fcmToken: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { fcmToken } });
    return { message: 'Push token saqlandi' };
  }

  async getSettings(userId: string) {
    return this.prisma.notificationSettings.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async updateSettings(userId: string, dto: Partial<{ budgetAlerts: boolean; dailyReminder: boolean; reminderTime: string; weeklyReport: boolean; pushEnabled: boolean }>) {
    return this.prisma.notificationSettings.upsert({ where: { userId }, update: dto, create: { userId, ...dto } });
  }
}
