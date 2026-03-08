// src/modules/admin/admin.controller.ts
import {
  Controller, Get, Post, Patch, Param, Body,
  UseGuards, Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiResponse,
  ApiOkResponse, ApiUnauthorizedResponse, ApiForbiddenResponse,
  ApiNotFoundResponse, ApiParam, ApiQuery,
} from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '@prisma/client';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

class BroadcastDto {
  @ApiProperty({ example: '🎉 Yangilik!' }) @IsString() title: string;
  @ApiProperty({ example: 'Hisobchi yangilandi!' }) @IsString() body: string;
}

class ChangeRoleDto {
  @ApiProperty({ enum: ['USER', 'ADMIN'], example: 'ADMIN' })
  @IsEnum(Role) role: 'USER' | 'ADMIN';
}

class UsersQueryDto {
  @ApiPropertyOptional({ example: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @ApiPropertyOptional({ example: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number = 20;
  @ApiPropertyOptional({ example: '+99890', description: 'Telefon yoki ism bo\'yicha qidirish' })
  @IsOptional() @IsString() search?: string;
}

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiUnauthorizedResponse({ description: 'Token taqdim etilmagan' })
@ApiForbiddenResponse({ description: 'ADMIN roli talab qilinadi' })
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Dashboard statistika',
    description: 'Jami foydalanuvchilar, tranzaksiyalar, oylik daromad/xarajat statistikasi.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        success: true,
        data: {
          users: { total: 1250, active: 1200, newThisMonth: 85, newToday: 12, telegram: 340 },
          transactions: { total: 45000, thisMonth: 3200, totalExpense: 85000000, totalIncome: 120000000 },
        },
      },
    },
  })
  getStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('growth')
  @ApiOperation({ summary: 'So\'nggi 30 kunlik foydalanuvchi o\'sish grafigi' })
  @ApiOkResponse({
    schema: {
      example: {
        success: true,
        data: [{ date: '2024-01-01', newUsers: 5 }, { date: '2024-01-02', newUsers: 8 }],
      },
    },
  })
  getGrowth() {
    return this.adminService.getUserGrowth();
  }

  @Get('users')
  @ApiOperation({ summary: 'Barcha foydalanuvchilar ro\'yxati (qidirish, pagination)' })
  @ApiOkResponse({
    schema: {
      example: {
        success: true,
        data: [{ id: 'uuid', phone: '+998901234567', name: 'Jasur', role: 'USER', isActive: true, _count: { transactions: 42 } }],
        meta: { total: 1250, page: 1, limit: 20, totalPages: 63 },
      },
    },
  })
  getUsers(@Query() query: UsersQueryDto) {
    return this.adminService.getUsers(query.page, query.limit, query.search);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Foydalanuvchi to\'liq tafsiloti' })
  @ApiParam({ name: 'id', description: 'Foydalanuvchi UUID' })
  @ApiNotFoundResponse({ description: 'Foydalanuvchi topilmadi' })
  getUserDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Patch('users/:id/block')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Foydalanuvchini bloklash', description: 'Refresh token ham bekor qilinadi.' })
  @ApiParam({ name: 'id', description: 'Foydalanuvchi UUID' })
  @ApiOkResponse({ schema: { example: { success: true, data: { message: 'Foydalanuvchi bloklandi' } } } })
  @ApiNotFoundResponse({ description: 'Foydalanuvchi topilmadi' })
  blockUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.toggleUserBlock(id, true);
  }

  @Patch('users/:id/unblock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Blokni ochish' })
  @ApiParam({ name: 'id', description: 'Foydalanuvchi UUID' })
  @ApiOkResponse({ schema: { example: { success: true, data: { message: 'Bloklash bekor qilindi' } } } })
  unblockUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.toggleUserBlock(id, false);
  }

  @Patch('users/:id/role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Foydalanuvchi rolini o\'zgartirish (USER ↔ ADMIN)' })
  @ApiParam({ name: 'id', description: 'Foydalanuvchi UUID' })
  @ApiOkResponse({ schema: { example: { success: true, data: { message: "Rol ADMIN ga o'zgartirildi" } } } })
  changeRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeRoleDto) {
    return this.adminService.changeRole(id, dto.role);
  }

  @Post('broadcast')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Barcha foydalanuvchilarga push xabar yuborish',
    description: 'Faqat isActive=true bo\'lgan foydalanuvchilarga yuboriladi.',
  })
  @ApiOkResponse({ schema: { example: { success: true, data: { message: 'Xabar 1200 ta foydalanuvchiga yuborildi' } } } })
  broadcast(@Body() dto: BroadcastDto) {
    return this.adminService.broadcast(dto.title, dto.body);
  }
}
