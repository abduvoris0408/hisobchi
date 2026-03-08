// src/modules/auth/auth.service.ts
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { SmsService } from './sms.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // OTP sozlamalari
  private readonly OTP_TTL = 120;        // 2 daqiqa
  private readonly OTP_MAX_ATTEMPTS = 3; // Max 3 urinish
  private readonly OTP_COOLDOWN = 60;    // Qayta yuborish uchun 1 daqiqa kutish

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private jwt: JwtService,
    private config: ConfigService,
    private sms: SmsService,
  ) {}

  // ── OTP Yuborish ───────────────────────────────────────────────────────
  async sendOtp(phone: string): Promise<{ message: string; expiresIn: number }> {
    // Cooldown tekshirish
    const cooldownKey = `otp:cooldown:${phone}`;
    const isCooldown = await this.redis.exists(cooldownKey);
    if (isCooldown) {
      const remaining = await this.redis.ttl(cooldownKey);
      throw new BadRequestException(
        `SMS yuborildi. ${remaining} soniyadan keyin qayta urinib ko'ring`,
      );
    }

    // 6 xonali OTP generatsiya
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const otpKey = `otp:${phone}`;

    // Redis'ga saqlash
    await this.redis.set(otpKey, JSON.stringify({ code, attempts: 0 }), this.OTP_TTL);
    await this.redis.set(cooldownKey, '1', this.OTP_COOLDOWN);

    // SMS yuborish
    const isDev = this.config.get('NODE_ENV') === 'development';
    if (isDev) {
      // Development muhitda SMS yubormasdan console'ga chiqarish
      this.logger.debug(`📱 OTP [${phone}]: ${code}`);
    } else {
      await this.sms.send(phone, `Hisobchi: tasdiqlash kodingiz ${code}. Amal qilish muddati 2 daqiqa.`);
    }

    return { message: 'SMS kod yuborildi', expiresIn: this.OTP_TTL };
  }

  // ── OTP Tekshirish va Login ────────────────────────────────────────────
  async verifyOtp(phone: string, code: string) {
    const otpKey = `otp:${phone}`;
    const cached = await this.redis.get(otpKey);

    if (!cached) {
      throw new BadRequestException('Kod muddati tugagan. Qaytadan so\'rang');
    }

    const { code: savedCode, attempts } = JSON.parse(cached);

    // Urinishlar soni tekshirish
    if (attempts >= this.OTP_MAX_ATTEMPTS) {
      await this.redis.del(otpKey);
      throw new ForbiddenException('Ko\'p noto\'g\'ri urinish. Yangi kod so\'rang');
    }

    // Kodni tekshirish
    if (savedCode !== code) {
      // Urinishlar sonini oshirish
      const remaining = await this.redis.ttl(otpKey);
      await this.redis.set(
        otpKey,
        JSON.stringify({ code: savedCode, attempts: attempts + 1 }),
        remaining,
      );
      throw new BadRequestException(
        `Noto'g'ri kod. ${this.OTP_MAX_ATTEMPTS - attempts - 1} ta urinish qoldi`,
      );
    }

    // OTP o'chirish
    await this.redis.del(otpKey);

    // User topish yoki yaratish
    let user = await this.prisma.user.findUnique({ where: { phone } });
    const isNewUser = !user;

    if (!user) {
      user = await this.prisma.user.create({
        data: { phone, isVerified: true },
      });
      this.logger.log(`🎉 Yangi foydalanuvchi: ${phone}`);
    }

    if (!user.isActive) {
      throw new ForbiddenException('Hisobingiz bloklangan. Qo\'llab-quvvatlash bilan bog\'laning');
    }

    // Tokenlar generatsiya
    const tokens = await this.generateTokens(user.id, user.phone, user.role);

    // Refresh tokenni DB'ga saqlash
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    return {
      ...tokens,
      isNewUser,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        language: user.language,
        currency: user.currency,
      },
    };
  }

  // ── Token Yangilash ───────────────────────────────────────────────────
  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Yaroqsiz refresh token');
      }

      if (!user.isActive) {
        throw new ForbiddenException('Hisob bloklangan');
      }

      const tokens = await this.generateTokens(user.id, user.phone, user.role);

      // Token rotatsiya — eski tokenni almashtirish
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: tokens.refreshToken },
      });

      return tokens;
    } catch {
      throw new UnauthorizedException('Qaytadan kiring');
    }
  }

  // ── Logout ────────────────────────────────────────────────────────────
  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  // ── Helper: Token generatsiya ─────────────────────────────────────────
  private async generateTokens(userId: string, phone: string, role: string) {
    const payload = { sub: userId, phone, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_EXPIRES', '15m'),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES', '30d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
