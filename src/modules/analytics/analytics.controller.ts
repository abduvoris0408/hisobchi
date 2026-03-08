// src/modules/analytics/analytics.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto, CategoryAnalyticsQueryDto } from './dto/analytics.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Analytics')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: 'Token taqdim etilmagan' })
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Oylik umumiy statistika',
    description: 'Berilgan oy uchun jami daromad, xarajat, balans va jamg\'arma foizi.',
  })
  @ApiResponse({
    status: 200,
    description: 'Oylik statistika',
    schema: {
      example: {
        success: true,
        data: {
          month: 1, year: 2024,
          totalExpense: 1500000, totalIncome: 3000000,
          balance: 1500000, savingsRate: 50,
          transactionCount: 42,
        },
      },
    },
  })
  getSummary(@CurrentUser('id') userId: string, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getMonthlySummary(userId, query.month!, query.year!);
  }

  @Get('by-category')
  @ApiOperation({
    summary: 'Kategoriya bo\'yicha tahlil',
    description: 'Donut chart uchun: har bir kategoriyaning xarajat ulushi (foiz va summa).',
  })
  @ApiResponse({
    status: 200,
    description: 'Kategoriya tahlili',
    schema: {
      example: {
        success: true,
        data: [
          { categoryId: 'uuid', categoryName: 'Oziq-ovqat', emoji: '🍔', color: '#FF6B6B', amount: 500000, count: 15, percentage: 33 },
          { categoryId: 'uuid', categoryName: 'Transport', emoji: '🚗', color: '#4ECDC4', amount: 300000, count: 20, percentage: 20 },
        ],
        meta: { total: 1500000 },
      },
    },
  })
  getByCategory(@CurrentUser('id') userId: string, @Query() query: CategoryAnalyticsQueryDto) {
    return this.analyticsService.getByCategory(userId, query.month!, query.year!, query.type);
  }

  @Get('daily')
  @ApiOperation({
    summary: 'Kunlik xarajatlar',
    description: 'Bar chart uchun: oyning har bir kuni uchun jami xarajat.',
  })
  @ApiResponse({
    status: 200,
    description: 'Kunlik xarajatlar',
    schema: {
      example: {
        success: true,
        data: [
          { day: 1, amount: 50000 },
          { day: 2, amount: 0 },
          { day: 3, amount: 120000 },
        ],
      },
    },
  })
  getDaily(@CurrentUser('id') userId: string, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getDailyExpenses(userId, query.month!, query.year!);
  }

  @Get('trend')
  @ApiOperation({
    summary: 'So\'nggi 6 oylik trend',
    description: 'Line chart uchun: so\'nggi 6 oy daromad va xarajat dinamikasi.',
  })
  @ApiResponse({
    status: 200,
    description: '6 oylik trend',
    schema: {
      example: {
        success: true,
        data: [
          { month: 8, year: 2023, totalExpense: 1200000, totalIncome: 2500000, balance: 1300000 },
          { month: 9, year: 2023, totalExpense: 1500000, totalIncome: 3000000, balance: 1500000 },
        ],
      },
    },
  })
  getTrend(@CurrentUser('id') userId: string) {
    return this.analyticsService.getMonthlyTrend(userId);
  }
}
