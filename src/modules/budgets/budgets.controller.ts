// src/modules/budgets/budgets.controller.ts
import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BudgetsService, CreateBudgetDto } from './budgets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

class BudgetQueryDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12)
  month?: number = new Date().getMonth() + 1;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt()
  year?: number = new Date().getFullYear();
}

@ApiTags('Budgets')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  @ApiOperation({ summary: 'Byudjetlar va hozirgi holat' })
  findAll(@CurrentUser('id') userId: string, @Query() query: BudgetQueryDto) {
    return this.budgetsService.findAll(userId, query.month!, query.year!);
  }

  @Post()
  @ApiOperation({ summary: 'Byudjet yaratish yoki yangilash' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateBudgetDto) {
    return this.budgetsService.create(userId, dto);
  }
}
