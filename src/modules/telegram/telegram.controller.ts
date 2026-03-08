// src/modules/telegram/telegram.controller.ts
import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { TelegramService } from './telegram.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class ConnectTelegramDto {
  @ApiProperty({ description: 'Telegram user ID', example: '123456789' })
  @IsString()
  telegramId: string;
}

@ApiTags('Telegram')
@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  // Telegram webhook — bu endpoint Telegram serverlaridan keladi
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Telegram webhook (Telegram serveri uchun)' })
  async handleWebhook(@Body() body: any) {
    await this.telegramService.handleWebhook(body);
    return { ok: true };
  }

  // Ilovadan Telegram ulash
  @Post('connect')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Telegram botini ilovaga ulash' })
  async connectTelegram(
    @CurrentUser('id') userId: string,
    @Body() dto: ConnectTelegramDto,
  ) {
    await this.telegramService.connectUser(userId, dto.telegramId);
    return { message: 'Telegram muvaffaqiyatli ulandi' };
  }
}
