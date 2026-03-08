// src/modules/transactions/transactions.controller.ts
import {
  Controller, Get, Post, Body, Patch, Param,
  Delete, UseGuards, Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiResponse,
  ApiCreatedResponse, ApiNotFoundResponse, ApiUnauthorizedResponse,
  ApiBadRequestResponse, ApiParam, ApiQuery,
} from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import {
  CreateTransactionDto, UpdateTransactionDto, TransactionQueryDto,
} from './dto/transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const txExample = {
  id: 'uuid', userId: 'uuid', categoryId: 'uuid',
  amount: '50000', type: 'EXPENSE', note: 'Tushlik',
  date: '2024-01-15T12:00:00.000Z', source: 'APP',
  category: { id: 'uuid', nameUz: 'Oziq-ovqat', emoji: '🍔', color: '#FF6B6B' },
};

@ApiTags('Transactions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: 'Token taqdim etilmagan yoki yaroqsiz' })
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({
    summary: 'Yangi xarajat/daromad qo\'shish',
    description: 'Tranzaksiya yaratadi va budget limitini avtomatik tekshiradi.',
  })
  @ApiCreatedResponse({
    description: 'Tranzaksiya yaratildi',
    schema: { example: { success: true, data: txExample } },
  })
  @ApiBadRequestResponse({ description: 'Noto\'g\'ri ma\'lumot yoki kategoriya topilmadi' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Tranzaksiyalar ro\'yxati',
    description: 'Pagination, type filter (EXPENSE/INCOME), kategoriya va sana bo\'yicha filter.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tranzaksiyalar ro\'yxati',
    schema: {
      example: {
        success: true,
        data: [txExample],
        meta: { total: 100, page: 1, limit: 20, totalPages: 5 },
      },
    },
  })
  findAll(@CurrentUser('id') userId: string, @Query() query: TransactionQueryDto) {
    return this.transactionsService.findAll(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta tranzaksiya tafsiloti' })
  @ApiParam({ name: 'id', description: 'Tranzaksiya UUID', example: 'uuid-here' })
  @ApiResponse({
    status: 200,
    description: 'Tranzaksiya topildi',
    schema: { example: { success: true, data: txExample } },
  })
  @ApiNotFoundResponse({ description: 'Tranzaksiya topilmadi' })
  findOne(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.transactionsService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Tranzaksiyani tahrirlash' })
  @ApiParam({ name: 'id', description: 'Tranzaksiya UUID' })
  @ApiResponse({
    status: 200,
    description: 'Tranzaksiya yangilandi',
    schema: { example: { success: true, data: txExample } },
  })
  @ApiNotFoundResponse({ description: 'Tranzaksiya topilmadi' })
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tranzaksiyani o\'chirish' })
  @ApiParam({ name: 'id', description: 'Tranzaksiya UUID' })
  @ApiResponse({
    status: 200,
    description: 'O\'chirildi',
    schema: { example: { success: true, data: { message: "Tranzaksiya o'chirildi" } } },
  })
  @ApiNotFoundResponse({ description: 'Tranzaksiya topilmadi' })
  remove(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.transactionsService.remove(userId, id);
  }
}
