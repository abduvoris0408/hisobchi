// test/auth.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/common/redis/redis.service';

describe('Auth E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const testPhone = '+998901111111';

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
  });

  afterAll(async () => {
    // Test foydalanuvchisini tozalash
    await prisma.user.deleteMany({ where: { phone: testPhone } });
    await app.close();
  });

  describe('POST /api/v1/auth/send-otp', () => {
    it('to\'g\'ri telefon bilan OTP yuborishi kerak', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/send-otp')
        .send({ phone: testPhone })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('expiresIn', 120);
    });

    it('noto\'g\'ri telefon bilan 400 qaytarishi kerak', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/send-otp')
        .send({ phone: '12345' })
        .expect(400);
    });

    it('telefonsiz 400 qaytarishi kerak', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/send-otp')
        .send({})
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/verify-otp', () => {
    let otpCode: string;

    beforeEach(async () => {
      // Redis dan OTP ni olish (test muhitida)
      await request(app.getHttpServer())
        .post('/api/v1/auth/send-otp')
        .send({ phone: testPhone });

      const cached = await redis.get(`otp:${testPhone}`);
      otpCode = JSON.parse(cached!).code;
    });

    it('to\'g\'ri kod bilan tokenlar qaytarishi kerak', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .send({ phone: testPhone, code: otpCode })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.user).toHaveProperty('phone', testPhone);
    });

    it('noto\'g\'ri kod bilan 400 qaytarishi kerak', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .send({ phone: testPhone, code: '000000' })
        .expect(400);
    });
  });

  describe('Protected routes', () => {
    let accessToken: string;

    beforeAll(async () => {
      // Login qilish
      await request(app.getHttpServer())
        .post('/api/v1/auth/send-otp')
        .send({ phone: testPhone });

      const cached = await redis.get(`otp:${testPhone}`);
      const code = JSON.parse(cached!).code;

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-otp')
        .send({ phone: testPhone, code });

      accessToken = res.body.data.accessToken;
    });

    it('token bilan /users/me ga kirish mumkin', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('phone', testPhone);
    });

    it('tokensiz /users/me ga kirish mumkin emas', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .expect(401);
    });

    it('noto\'g\'ri token bilan 401 qaytarishi kerak', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
