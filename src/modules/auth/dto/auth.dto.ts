// src/modules/auth/dto/auth.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, Length } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({ example: '+998901234567', description: "O'zbek telefon raqami" })
  @IsString()
  @Matches(/^\+998[0-9]{9}$/, { message: "Telefon raqami +998XXXXXXXXX formatida bo'lishi kerak" })
  phone: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '+998901234567' })
  @IsString()
  @Matches(/^\+998[0-9]{9}$/, { message: "Telefon raqami noto'g'ri" })
  phone: string;

  @ApiProperty({ example: '123456', description: '6 xonali SMS kod' })
  @IsString()
  @Length(6, 6, { message: "Kod 6 ta raqamdan iborat bo'lishi kerak" })
  code: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token' })
  @IsString()
  refreshToken: string;
}
