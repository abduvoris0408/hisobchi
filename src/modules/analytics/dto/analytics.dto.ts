// src/modules/analytics/dto/analytics.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType } from '@prisma/client';

export class AnalyticsQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Oy (1-12)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number = new Date().getMonth() + 1;

  @ApiPropertyOptional({ example: 2024, description: 'Yil' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  year?: number = new Date().getFullYear();
}

export class CategoryAnalyticsQueryDto extends AnalyticsQueryDto {
  @ApiPropertyOptional({ enum: TransactionType, default: TransactionType.EXPENSE })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType = TransactionType.EXPENSE;
}
