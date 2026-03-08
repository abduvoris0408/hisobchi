// src/modules/transactions/transactions.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BudgetsService } from '../budgets/budgets.service';
import { CreateTransactionDto, UpdateTransactionDto, TransactionQueryDto } from './dto/transaction.dto';
import { TransactionSource } from '@prisma/client';
import { AppLogger } from '../../common/logger/logger.service';

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private budgets: BudgetsService,
    private logger: AppLogger,
  ) {}

  async create(
    userId: string,
    dto: CreateTransactionDto,
    source: TransactionSource = TransactionSource.APP,
  ) {
    // Kategoriya foydalanuvchiga tegishlimi yoki default?
    const category = await this.prisma.category.findFirst({
      where: {
        id: dto.categoryId,
        OR: [{ userId }, { isDefault: true }],
      },
    });

    if (!category) throw new NotFoundException('Kategoriya topilmadi');

    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        categoryId: dto.categoryId,
        amount: dto.amount,
        type: dto.type,
        note: dto.note,
        receiptUrl: dto.receiptUrl,
        date: dto.date ? new Date(dto.date) : new Date(),
        source,
      },
      include: { category: true },
    });

    // EXPENSE bo'lsa — budget limitini REAL tekshirish
    if (dto.type === 'EXPENSE') {
      this.budgets.checkAndAlert(userId, dto.categoryId, dto.amount).catch((err) => {
        this.logger.error('Budget check xatosi:', err?.message, 'TransactionsService');
      });
    }

    this.logger.log(
      `Transaction created: ${dto.type} ${dto.amount} | User: ${userId} | Source: ${source}`,
      'TransactionsService',
    );

    return transaction;
  }

  async findAll(userId: string, query: TransactionQueryDto) {
    const { page = 1, limit = 20, type, categoryId, from, to } = query;

    const where: any = { userId };
    if (type) where.type = type;
    if (categoryId) where.categoryId = categoryId;
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to + 'T23:59:59');
    }

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: { category: true },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: transactions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(userId: string, id: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
      include: { category: true },
    });

    if (!transaction) throw new NotFoundException('Tranzaksiya topilmadi');
    return transaction;
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    await this.findOne(userId, id);

    return this.prisma.transaction.update({
      where: { id },
      data: {
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.type && { type: dto.type }),
        ...(dto.note !== undefined && { note: dto.note }),
        ...(dto.receiptUrl !== undefined && { receiptUrl: dto.receiptUrl }),
        ...(dto.date && { date: new Date(dto.date) }),
      },
      include: { category: true },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.transaction.delete({ where: { id } });
    return { message: "Tranzaksiya o'chirildi" };
  }

  // Telegram bot uchun
  async getRecentForTelegram(userId: string, count = 5) {
    return this.prisma.transaction.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { date: 'desc' },
      take: count,
    });
  }
}
