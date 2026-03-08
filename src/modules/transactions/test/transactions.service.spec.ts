// src/modules/transactions/test/transactions.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from '../transactions.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { TransactionType, TransactionSource } from '@prisma/client';

const mockPrisma = {
  category: { findFirst: jest.fn() },
  transaction: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

const mockCategory = {
  id: 'cat-uuid-1', nameUz: 'Oziq-ovqat', emoji: '🍔',
  color: '#FF6B6B', type: TransactionType.EXPENSE, isDefault: true,
};

const mockTransaction = {
  id: 'tx-uuid-1', userId: 'user-uuid-1', categoryId: 'cat-uuid-1',
  amount: 50000, type: TransactionType.EXPENSE, note: 'Tushlik',
  date: new Date(), source: TransactionSource.APP,
  category: mockCategory,
};

describe('TransactionsService', () => {
  let service: TransactionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it("tranzaksiya yaratishi kerak", async () => {
      mockPrisma.category.findFirst.mockResolvedValue(mockCategory);
      mockPrisma.transaction.create.mockResolvedValue(mockTransaction);

      const result = await service.create('user-uuid-1', {
        categoryId: 'cat-uuid-1',
        amount: 50000,
        type: TransactionType.EXPENSE,
      });

      expect(result).toEqual(mockTransaction);
      expect(mockPrisma.transaction.create).toHaveBeenCalledTimes(1);
    });

    it("noto'g'ri kategoriya bilan xato qaytarishi kerak", async () => {
      mockPrisma.category.findFirst.mockResolvedValue(null);

      await expect(
        service.create('user-uuid-1', { categoryId: 'wrong-cat', amount: 50000, type: TransactionType.EXPENSE })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it("pagination bilan tranzaksiyalar qaytarishi kerak", async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([mockTransaction]);
      mockPrisma.transaction.count.mockResolvedValue(1);

      const result = await service.findAll('user-uuid-1', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('findOne', () => {
    it("mavjud tranzaksiyani qaytarishi kerak", async () => {
      mockPrisma.transaction.findFirst.mockResolvedValue(mockTransaction);

      const result = await service.findOne('user-uuid-1', 'tx-uuid-1');
      expect(result).toEqual(mockTransaction);
    });

    it("mavjud bo'lmagan tranzaksiya uchun xato qaytarishi kerak", async () => {
      mockPrisma.transaction.findFirst.mockResolvedValue(null);

      await expect(service.findOne('user-uuid-1', 'wrong-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it("tranzaksiyani o'chirishi kerak", async () => {
      mockPrisma.transaction.findFirst.mockResolvedValue(mockTransaction);
      mockPrisma.transaction.delete.mockResolvedValue(mockTransaction);

      const result = await service.remove('user-uuid-1', 'tx-uuid-1');
      expect(result).toHaveProperty('message');
    });
  });
});
