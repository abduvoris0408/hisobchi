// src/modules/budgets/budgets.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionType, BudgetPeriod } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID, IsEnum, Min, IsInt, Max } from 'class-validator';
import { AppLogger } from '../../common/logger/logger.service';

export class CreateBudgetDto {
  @ApiPropertyOptional({ description: "null = umumiy byudjet" })
  @IsOptional() @IsUUID()
  categoryId?: string;

  @ApiProperty({ example: 1000000 })
  @IsNumber() @Min(1000)
  amount: number;

  @ApiPropertyOptional({ enum: BudgetPeriod })
  @IsOptional() @IsEnum(BudgetPeriod)
  period?: BudgetPeriod = BudgetPeriod.MONTHLY;

  @ApiProperty({ example: 1 }) @IsInt() @Min(1) @Max(12) month: number;
  @ApiProperty({ example: 2024 }) @IsInt() year: number;

  @ApiPropertyOptional({ example: 80 })
  @IsOptional() @IsInt() @Min(50) @Max(100)
  alertAt?: number = 80;
}

export interface IBudgetNotifier {
  sendBudgetAlert(userId: string, categoryName: string, percentage: number, isExceeded: boolean): Promise<void>;
}

@Injectable()
export class BudgetsService {
  private notifier: IBudgetNotifier | null = null;

  constructor(private prisma: PrismaService, private logger: AppLogger) {}

  setNotifier(notifier: IBudgetNotifier) {
    this.notifier = notifier;
  }

  async findAll(userId: string, month: number, year: number) {
    const budgets = await this.prisma.budget.findMany({
      where: { userId, month, year },
      include: { category: true },
    });

    const withStatus = await Promise.all(budgets.map(async (budget) => {
      const spent = await this.prisma.transaction.aggregate({
        where: {
          userId, type: TransactionType.EXPENSE,
          ...(budget.categoryId ? { categoryId: budget.categoryId } : {}),
          date: { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0, 23, 59, 59) },
        },
        _sum: { amount: true },
      });
      const spentAmt = Number(spent._sum.amount ?? 0);
      const budgetAmt = Number(budget.amount);
      const percentage = budgetAmt > 0 ? Math.round((spentAmt / budgetAmt) * 100) : 0;
      return {
        ...budget,
        spent: spentAmt,
        remaining: Math.max(0, budgetAmt - spentAmt),
        percentage,
        status: percentage >= 100 ? 'exceeded' : percentage >= budget.alertAt ? 'warning' : 'ok',
      };
    }));

    return { data: withStatus };
  }

  async create(userId: string, dto: CreateBudgetDto) {
    // PostgreSQL NULL != NULL — unique constraint null bilan ishlamaydi
    // Shuning uchun upsert o'rniga findFirst + update/create ishlatamiz
    const existing = await this.prisma.budget.findFirst({
      where: {
        userId,
        categoryId: dto.categoryId ?? null,
        month: dto.month,
        year: dto.year,
      },
    });

    if (existing) {
      return this.prisma.budget.update({
        where: { id: existing.id },
        data: { amount: dto.amount, alertAt: dto.alertAt ?? 80 },
        include: { category: true },
      });
    }

    return this.prisma.budget.create({
      data: { userId, ...dto },
      include: { category: true },
    });
  }

  async checkAndAlert(userId: string, categoryId: string, newAmount: number): Promise<void> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const budgets = await this.prisma.budget.findMany({
      where: {
        userId, month, year,
        OR: [{ categoryId }, { categoryId: null }],
      },
      include: { category: true },
    });

    if (!budgets.length) return;

    for (const budget of budgets) {
      const spent = await this.prisma.transaction.aggregate({
        where: {
          userId, type: TransactionType.EXPENSE,
          ...(budget.categoryId ? { categoryId: budget.categoryId } : {}),
          date: { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0, 23, 59, 59) },
        },
        _sum: { amount: true },
      });

      const prevSpent = Number(spent._sum.amount ?? 0);
      const totalSpent = prevSpent + newAmount;
      const budgetAmt = Number(budget.amount);
      const prevPct = Math.round((prevSpent / budgetAmt) * 100);
      const newPct = Math.round((totalSpent / budgetAmt) * 100);
      const categoryName = budget.category?.nameUz ?? 'Umumiy byudjet';

      if (prevPct < budget.alertAt && newPct >= budget.alertAt && this.notifier) {
        this.logger.log(`Budget alert: ${categoryName} ${newPct}%`, 'BudgetsService');
        await this.notifier.sendBudgetAlert(userId, categoryName, newPct, newPct >= 100);
      }
    }
  }
}
