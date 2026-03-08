// src/modules/notifications/notifications.controller.ts
import {
  Controller, Get, Post, Patch, Body, Param,
  UseGuards, Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiResponse,
  ApiUnauthorizedResponse, ApiOkResponse, ApiNotFoundResponse, ApiParam,
} from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, Matches, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class RegisterTokenDto {
  @ApiProperty({ description: 'Firebase FCM device token', example: 'fxk2...' })
  @IsString()
  fcmToken: string;
}

class UpdateSettingsDto {
  @ApiPropertyOptional({ description: 'Budget ogohlantirish', example: true })
  @IsOptional() @IsBoolean() budgetAlerts?: boolean;

  @ApiPropertyOptional({ description: 'Kunlik eslatma', example: true })
  @IsOptional() @IsBoolean() dailyReminder?: boolean;

  @ApiPropertyOptional({ description: 'Eslatma vaqti (HH:MM)', example: '21:00' })
  @IsOptional() @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "HH:MM formatida bo'lishi kerak" })
  reminderTime?: string;

  @ApiPropertyOptional({ description: 'Haftalik hisobot', example: true })
  @IsOptional() @IsBoolean() weeklyReport?: boolean;

  @ApiPropertyOptional({ description: 'Push notification', example: true })
  @IsOptional() @IsBoolean() pushEnabled?: boolean;
}

class PaginationQueryDto {
  @ApiPropertyOptional({ example: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @ApiPropertyOptional({ example: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number = 20;
}

const notifExample = {
  id: 'uuid', userId: 'uuid', title: '⚠️ Byudjet ogohlantirishи',
  body: 'Oziq-ovqat byudjetining 85% sarflandi',
  type: 'BUDGET_ALERT', isRead: false, createdAt: '2024-01-15T12:00:00.000Z',
};

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: 'Token taqdim etilmagan' })
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('register-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'FCM Push token saqlash',
    description: 'Qurilma FCM tokenini saqlaydi. Ilovani har ochganda yangilash tavsiya etiladi.',
  })
  @ApiOkResponse({
    schema: { example: { success: true, data: { message: 'Push token saqlandi' } } },
  })
  registerToken(@CurrentUser('id') userId: string, @Body() dto: RegisterTokenDto) {
    return this.notificationsService.registerToken(userId, dto.fcmToken);
  }

  @Get()
  @ApiOperation({
    summary: 'Bildirishnomalar ro\'yxati',
    description: 'Pagination bilan. Meta da o\'qilmagan (unreadCount) soni ham keladi.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        success: true,
        data: [notifExample],
        meta: { total: 15, page: 1, limit: 20, totalPages: 1, unreadCount: 3 },
      },
    },
  })
  findAll(@CurrentUser('id') userId: string, @Query() query: PaginationQueryDto) {
    return this.notificationsService.findAll(userId, query.page, query.limit);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Bitta bildirishnomani o\'qildi deb belgilash' })
  @ApiParam({ name: 'id', description: 'Bildirishnoma UUID' })
  @ApiOkResponse({ schema: { example: { success: true, data: { count: 1 } } } })
  markAsRead(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationsService.markAsRead(userId, id);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Barcha bildirishnomalarni o\'qildi deb belgilash' })
  @ApiOkResponse({
    schema: { example: { success: true, data: { message: "Barcha bildirishnomalar o'qildi deb belgilandi" } } },
  })
  markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Bildirishnoma sozlamalarini olish' })
  @ApiOkResponse({
    schema: {
      example: {
        success: true,
        data: {
          budgetAlerts: true, dailyReminder: true,
          reminderTime: '21:00', weeklyReport: true, pushEnabled: true,
        },
      },
    },
  })
  getSettings(@CurrentUser('id') userId: string) {
    return this.notificationsService.getSettings(userId);
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Bildirishnoma sozlamalarini yangilash' })
  @ApiOkResponse({ schema: { example: { success: true, data: { budgetAlerts: true } } } })
  updateSettings(@CurrentUser('id') userId: string, @Body() dto: UpdateSettingsDto) {
    return this.notificationsService.updateSettings(userId, dto);
  }
}
