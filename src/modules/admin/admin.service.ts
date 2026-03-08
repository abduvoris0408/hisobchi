// src/modules/admin/admin.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ── Dashboard statistika ─────────────────────────────────────────────
  async getDashboardStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));

    const [
      totalUsers,
      activeUsers,
      newUsersThisMonth,
      newUsersToday,
      totalTransactions,
      transactionsThisMonth,
      totalExpenseThisMonth,
      totalIncomeThisMonth,
      telegramUsers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
      this.prisma.transaction.count(),
      this.prisma.transaction.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.transaction.aggregate({
        where: { type: 'EXPENSE', date: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { type: 'INCOME', date: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      this.prisma.user.count({ where: { telegramId: { not: null } } }),
    ]);

    return {
      users: { total: totalUsers, active: activeUsers, newThisMonth: newUsersThisMonth, newToday: newUsersToday, telegram: telegramUsers },
      transactions: {
        total: totalTransactions,
        thisMonth: transactionsThisMonth,
        totalExpense: Number(totalExpenseThisMonth._sum.amount ?? 0),
        totalIncome: Number(totalIncomeThisMonth._sum.amount ?? 0),
      },
    };
  }

  // ── Foydalanuvchilar ro'yxati ─────────────────────────────────────────
  async getUsers(page = 1, limit = 20, search?: string) {
    const where: any = {};
    if (search) {
      where.OR = [
        { phone: { contains: search } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true, phone: true, name: true, avatarUrl: true,
          role: true, isActive: true, language: true,
          telegramId: true, createdAt: true,
          _count: { select: { transactions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Foydalanuvchi tafsiloti ───────────────────────────────────────────
  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: { select: { transactions: true, budgets: true } },
      },
    });

    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

    const stats = await this.prisma.transaction.aggregate({
      where: { userId },
      _sum: { amount: true },
      _count: true,
    });

    return { ...user, stats };
  }

  // ── Foydalanuvchini bloklash/ochish ──────────────────────────────────
  async toggleUserBlock(userId: string, block: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: !block,
        ...(block ? { refreshToken: null } : {}),
      },
    });

    return { message: block ? 'Foydalanuvchi bloklandi' : 'Bloklash bekor qilindi' };
  }

  // ── Rolni o'zgartirish ────────────────────────────────────────────────
  async changeRole(userId: string, role: 'USER' | 'ADMIN') {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

    await this.prisma.user.update({ where: { id: userId }, data: { role } });
    return { message: `Rol ${role} ga o'zgartirildi` };
  }

  // ── Broadcast xabar ──────────────────────────────────────────────────
  async broadcast(title: string, body: string, targetAll = true) {
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    let sent = 0;
    for (const user of users) {
      try {
        await this.notifications.send(user.id, title, body, NotificationType.SYSTEM);
        sent++;
      } catch {}
    }

    return { message: `Xabar ${sent} ta foydalanuvchiga yuborildi` };
  }

  // ── O'sish grafigi (so'nggi 30 kun) ──────────────────────────────────
  async getUserGrowth() {
    const days = 30;
    const result = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = await this.prisma.user.count({
        where: { createdAt: { gte: date, lt: nextDate } },
      });

      result.push({
        date: date.toISOString().split('T')[0],
        newUsers: count,
      });
    }

    return { data: result };
  }
}
