// test/transactions.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/common/redis/redis.service';

describe('Transactions E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let accessToken: string;
  let userId: string;
  let defaultCategoryId: string;
  let createdTransactionId: string;
  const testPhone = '+998902222222';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    await app.init();

    // Login
    await request(app.getHttpServer()).post('/api/v1/auth/send-otp').send({ phone: testPhone });
    const cached = await redis.get(`otp:${testPhone}`);
    const code = JSON.parse(cached!).code;
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/verify-otp')
      .send({ phone: testPhone, code });

    accessToken = res.body.data.accessToken;
    userId = res.body.data.user.id;

    // Default kategoriyani olish
    const catRes = await request(app.getHttpServer())
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${accessToken}`);
    defaultCategoryId = catRes.body.data[0].id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { phone: testPhone } });
    await app.close();
  });

  describe('POST /api/v1/transactions', () => {
    it('yangi xarajat yaratishi kerak', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          categoryId: defaultCategoryId,
          amount: 50000,
          type: 'EXPENSE',
          note: 'E2E test xarajati',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.amount).toBe('50000');
      createdTransactionId = res.body.data.id;
    });

    it('summasiz 400 qaytarishi kerak', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/transactions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ categoryId: defaultCategoryId, type: 'EXPENSE' })
        .expect(400);
    });
  });

  describe('GET /api/v1/transactions', () => {
    it('pagination bilan tranzaksiyalar qaytarishi kerak', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/transactions?page=1&limit=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body.meta).toHaveProperty('totalPages');
    });

    it('type filter ishlashi kerak', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/transactions?type=EXPENSE')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      res.body.data.forEach((t: any) => {
        expect(t.type).toBe('EXPENSE');
      });
    });
  });

  describe('GET /api/v1/transactions/:id', () => {
    it('bitta tranzaksiya qaytarishi kerak', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/transactions/${createdTransactionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(createdTransactionId);
    });

    it('boshqa foydalanuvchi tranzaksiyasiga kirish mumkin emas', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/transactions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('DELETE /api/v1/transactions/:id', () => {
    it("tranzaksiyani o'chirishi kerak", async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/transactions/${createdTransactionId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('message');
    });
  });

  describe('GET /api/v1/analytics/summary', () => {
    it('oylik summary qaytarishi kerak', async () => {
      const month = new Date().getMonth() + 1;
      const year = new Date().getFullYear();

      const res = await request(app.getHttpServer())
        .get(`/api/v1/analytics/summary?month=${month}&year=${year}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('totalExpense');
      expect(res.body.data).toHaveProperty('totalIncome');
      expect(res.body.data).toHaveProperty('balance');
    });
  });
});
