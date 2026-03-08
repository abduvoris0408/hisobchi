// src/modules/auth/auth.controller.ts
import {
  Controller, Post, Body, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth,
  ApiBody, ApiUnauthorizedResponse, ApiBadRequestResponse,
  ApiTooManyRequestsResponse, ApiForbiddenResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SendOtpDto, VerifyOtpDto, RefreshTokenDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({
    summary: 'SMS OTP yuborish',
    description: "Telefon raqamga 6 xonali SMS kod yuboradi. 1 daqiqada 3 martadan ko'p so'rov qilish mumkin emas.",
  })
  @ApiBody({ type: SendOtpDto })
  @ApiResponse({
    status: 200,
    description: 'SMS muvaffaqiyatli yuborildi',
    schema: {
      example: {
        success: true,
        data: { message: 'SMS kod yuborildi', expiresIn: 120 },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Noto\'g\'ri telefon formati yoki cooldown davri',
    schema: { example: { success: false, statusCode: 400, message: "Telefon raqami +998XXXXXXXXX formatida bo'lishi kerak" } },
  })
  @ApiTooManyRequestsResponse({ description: '1 daqiqada 3 martadan ko\'p so\'rov' })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.phone);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'OTP tekshirish va login/ro\'yxat',
    description: 'Kod to\'g\'ri bo\'lsa access + refresh token qaytaradi. Yangi foydalanuvchi bo\'lsa avtomatik ro\'yxatdan o\'tadi.',
  })
  @ApiBody({ type: VerifyOtpDto })
  @ApiResponse({
    status: 200,
    description: 'Muvaffaqiyatli kirish',
    schema: {
      example: {
        success: true,
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiJ9...',
          refreshToken: 'eyJhbGciOiJIUzI1NiJ9...',
          isNewUser: false,
          user: {
            id: 'uuid', phone: '+998901234567',
            name: null, avatarUrl: null,
            role: 'USER', language: 'uz_latn', currency: 'UZS',
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Noto\'g\'ri yoki muddati tugagan kod' })
  @ApiForbiddenResponse({ description: 'Ko\'p noto\'g\'ri urinish — yangi kod so\'rang' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phone, dto.code);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Access tokenni yangilash',
    description: 'Refresh token orqali yangi access + refresh token olish (token rotation).',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Yangi tokenlar',
    schema: {
      example: {
        success: true,
        data: { accessToken: 'eyJ...', refreshToken: 'eyJ...' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Yaroqsiz yoki eskirgan refresh token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chiqish', description: 'Refresh tokenni bekor qiladi.' })
  @ApiResponse({
    status: 200,
    description: 'Muvaffaqiyatli chiqish',
    schema: { example: { success: true, data: null } },
  })
  @ApiUnauthorizedResponse({ description: 'Token taqdim etilmagan' })
  logout(@CurrentUser('id') userId: string) {
    return this.authService.logout(userId);
  }
}
