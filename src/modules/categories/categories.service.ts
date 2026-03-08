// src/modules/categories/categories.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, Matches } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Sport' })
  @IsString()
  nameUz: string;

  @ApiProperty({ example: '⚽' })
  @IsString()
  emoji: string;

  @ApiProperty({ example: '#FF5733' })
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Rang HEX formatida bo\'lishi kerak (#RRGGBB)' })
  color: string;

  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  type: TransactionType;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  // Default + foydalanuvchi kategoriyalari
  async findAll(userId: string) {
    return this.prisma.category.findMany({
      where: { OR: [{ userId }, { isDefault: true }] },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { nameUz: 'asc' }],
    });
  }

  async create(userId: string, dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: { ...dto, name: dto.nameUz, userId, isDefault: false },
    });
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({ where: { id } });

    if (!category) throw new NotFoundException('Kategoriya topilmadi');
    if (category.isDefault) throw new ForbiddenException('Default kategoriyani o\'zgartirish mumkin emas');
    if (category.userId !== userId) throw new ForbiddenException('Bu kategoriya sizga tegishli emas');

    return this.prisma.category.update({
      where: { id },
      data: { ...dto, ...(dto.nameUz && { name: dto.nameUz }) },
    });
  }

  async remove(userId: string, id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });

    if (!category) throw new NotFoundException('Kategoriya topilmadi');
    if (category.isDefault) throw new ForbiddenException('Default kategoriyani o\'chirish mumkin emas');
    if (category.userId !== userId) throw new ForbiddenException('Bu kategoriya sizga tegishli emas');

    await this.prisma.category.delete({ where: { id } });
    return { message: 'Kategoriya o\'chirildi' };
  }
}
