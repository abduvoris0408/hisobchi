// src/modules/users/users.controller.ts
import {
  Controller, Get, Put, Body, Delete,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiResponse,
  ApiUnauthorizedResponse, ApiOkResponse,
} from '@nestjs/swagger';
import { UsersService, UpdateUserDto } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const userExample = {
  id: 'uuid', phone: '+998901234567', name: 'Jasur Toshmatov',
  avatarUrl: 'https://...', currency: 'UZS', language: 'uz_latn',
  role: 'USER', telegramId: null, createdAt: '2024-01-01T00:00:00.000Z',
};

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: 'Token taqdim etilmagan' })
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({
    summary: 'O\'z profilini ko\'rish',
    description: 'Joriy foydalanuvchi profili, sozlamalar va telegram holati.',
  })
  @ApiOkResponse({
    description: 'Profil ma\'lumotlari',
    schema: { example: { success: true, data: userExample } },
  })
  getMe(@CurrentUser('id') userId: string) {
    return this.usersService.findById(userId);
  }

  @Put('me')
  @ApiOperation({
    summary: 'Profilni yangilash',
    description: 'Ism, til (uz_latn/uz_cyrl/ru), valyuta (UZS/USD), FCM token yangilash.',
  })
  @ApiOkResponse({
    description: 'Profil yangilandi',
    schema: { example: { success: true, data: userExample } },
  })
  updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(userId, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hisobni o\'chirish',
    description: 'Hisob deaktivatsiya qilinadi (ma\'lumotlar saqlanib qoladi).',
  })
  @ApiOkResponse({
    description: 'Hisob o\'chirildi',
    schema: { example: { success: true, data: { message: 'Hisob o\'chirildi' } } },
  })
  deleteMe(@CurrentUser('id') userId: string) {
    return this.usersService.deleteAccount(userId);
  }
}
