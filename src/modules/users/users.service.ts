// src/modules/users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { Language } from '@prisma/client';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Jasur Toshmatov' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: Language })
  @IsOptional()
  @IsEnum(Language)
  language?: Language;

  @ApiPropertyOptional({ example: 'UZS' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fcmToken?: string;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, phone: true, name: true, avatarUrl: true,
        currency: true, language: true, role: true,
        telegramId: true, telegramUsername: true,
        isActive: true, createdAt: true,
        notifSettings: true,
      },
    });

    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true, phone: true, name: true, avatarUrl: true,
        currency: true, language: true, role: true,
      },
    });
  }

  async updateAvatar(id: string, avatarUrl: string) {
    return this.prisma.user.update({
      where: { id },
      data: { avatarUrl },
      select: { id: true, avatarUrl: true },
    });
  }

  async deleteAccount(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false, refreshToken: null },
    });
    return { message: 'Hisob o\'chirildi' };
  }
}
