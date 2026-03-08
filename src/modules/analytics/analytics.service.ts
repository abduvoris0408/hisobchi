// src/modules/analytics/analytics.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionType } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // Oylik umumiy statistika
  async getMonthlySummary(userId: string, month: number, year: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const [totalExpense, totalIncome] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { userId, type: TransactionType.EXPENSE, date: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.transaction.aggregate({
        where: { userId, type: TransactionType.INCOME, date: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const expense = Number(totalExpense._sum.amount ?? 0);
    const income = Number(totalIncome._sum.amount ?? 0);

    return {
      data: {
        month, year,
        totalExpense: expense,
        totalIncome: income,
        balance: income - expense,
        savingsRate: income > 0 ? Math.round(((income - expense) / income) * 100) : 0,
        transactionCount: totalExpense._count + totalIncome._count,
      },
    };
  }

  // Kategoriya bo'yicha tahlil (donut chart uchun)
  async getByCategory(userId: string, month: number, year: number, type: TransactionType = TransactionType.EXPENSE) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const grouped = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId, type, date: { gte: start, lte: end } },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } },
    });

    // Kategoriya ma'lumotlarini olish
    const categoryIds = grouped.map((g) => g.categoryId);
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
    });

    const totalAmount = grouped.reduce((sum, g) => sum + Number(g._sum.amount ?? 0), 0);

    const result = grouped.map((g) => {
      const category = categories.find((c) => c.id === g.categoryId);
      const amount = Number(g._sum.amount ?? 0);
      return {
        categoryId: g.categoryId,
        categoryName: category?.nameUz ?? 'Noma\'lum',
        emoji: category?.emoji ?? '📦',
        color: category?.color ?? '#A9A9A9',
        amount,
        count: g._count,
        percentage: totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0,
      };
    });

    return { data: result, meta: { total: totalAmount } };
  }

  // Kunlik xarajatlar (bar chart uchun)
  async getDailyExpenses(userId: string, month: number, year: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const transactions = await this.prisma.transaction.findMany({
      where: { userId, type: TransactionType.EXPENSE, date: { gte: start, lte: end } },
      select: { amount: true, date: true },
    });

    // Kunlar bo'yicha guruhlash
    const dailyMap: Record<number, number> = {};
    transactions.forEach((t) => {
      const day = new Date(t.date).getDate();
      dailyMap[day] = (dailyMap[day] ?? 0) + Number(t.amount);
    });

    const daysInMonth = new Date(year, month, 0).getDate();
    const daily = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      amount: dailyMap[i + 1] ?? 0,
    }));

    return { data: daily };
  }

  // So'nggi 6 oylik trend
  async getMonthlyTrend(userId: string) {
    const results = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();

      const summary = await this.getMonthlySummary(userId, month, year);
      const { month: m, year: y, ...rest } = summary.data;
      results.push({ month, year, ...rest });
    }

    return { data: results };
  }
}
