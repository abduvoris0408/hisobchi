// src/modules/auth/test/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import { SmsService } from '../sms.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

// Mock'lar
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  ttl: jest.fn(),
};

const mockJwt = {
  signAsync: jest.fn(),
  verify: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string) => {
    const map: Record<string, string> = {
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'test-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      JWT_ACCESS_EXPIRES: '15m',
      JWT_REFRESH_EXPIRES: '30d',
    };
    return map[key];
  }),
};

const mockSms = { send: jest.fn() };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: SmsService, useValue: mockSms },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // ── sendOtp testlari ──────────────────────────────────────────────
  describe('sendOtp', () => {
    it("cooldown bo'lmasa OTP yuborishi kerak", async () => {
      mockRedis.exists.mockResolvedValue(false);
      mockRedis.set.mockResolvedValue(undefined);

      const result = await service.sendOtp('+998901234567');

      expect(mockRedis.set).toHaveBeenCalledTimes(2); // OTP + cooldown
      expect(result).toHaveProperty('expiresIn', 120);
      expect(result).toHaveProperty('message');
    });

    it("cooldown bo'lsa xato qaytarishi kerak", async () => {
      mockRedis.exists.mockResolvedValue(true);
      mockRedis.ttl.mockResolvedValue(45);

      await expect(service.sendOtp('+998901234567')).rejects.toThrow(BadRequestException);
    });
  });

  // ── verifyOtp testlari ────────────────────────────────────────────
  describe('verifyOtp', () => {
    it("to'g'ri kod bilan login qilishi kerak", async () => {
      const mockUser = {
        id: 'uuid-1', phone: '+998901234567', name: null,
        avatarUrl: null, role: 'USER', isActive: true,
        refreshToken: null, language: 'uz_latn', currency: 'UZS',
      };

      mockRedis.get.mockResolvedValue(JSON.stringify({ code: '123456', attempts: 0 }));
      mockRedis.del.mockResolvedValue(undefined);
      mockRedis.ttl.mockResolvedValue(100);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);
      mockJwt.signAsync.mockResolvedValue('mock-token');

      const result = await service.verifyOtp('+998901234567', '123456');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
    });

    it("noto'g'ri kod bilan xato qaytarishi kerak", async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ code: '123456', attempts: 0 }));
      mockRedis.ttl.mockResolvedValue(100);
      mockRedis.set.mockResolvedValue(undefined);

      await expect(service.verifyOtp('+998901234567', '000000')).rejects.toThrow(BadRequestException);
    });

    it("muddati tugagan kod bilan xato qaytarishi kerak", async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.verifyOtp('+998901234567', '123456')).rejects.toThrow(BadRequestException);
    });

    it('bloklangan foydalanuvchi kira olmasligi kerak', async () => {
      const blockedUser = { id: 'uuid-2', phone: '+998901234567', isActive: false, role: 'USER' };

      mockRedis.get.mockResolvedValue(JSON.stringify({ code: '123456', attempts: 0 }));
      mockRedis.del.mockResolvedValue(undefined);
      mockPrisma.user.findUnique.mockResolvedValue(blockedUser);

      await expect(service.verifyOtp('+998901234567', '123456')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── logout testlari ───────────────────────────────────────────────
  describe('logout', () => {
    it('refresh tokenni o\'chirishi kerak', async () => {
      mockPrisma.user.update.mockResolvedValue({});

      await service.logout('uuid-1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
        data: { refreshToken: null },
      });
    });
  });
});
