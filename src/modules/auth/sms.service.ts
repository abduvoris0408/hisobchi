// src/modules/auth/sms.service.ts
import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly baseUrl = 'https://notify.eskiz.uz/api';
  private token: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(private config: ConfigService) {}

  // Token olish (24 soat amal qiladi)
  private async getToken(): Promise<string> {
    if (this.token && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.token;
    }

    try {
      const { data } = await axios.post(`${this.baseUrl}/auth/login`, {
        email: this.config.get('ESKIZ_EMAIL'),
        password: this.config.get('ESKIZ_PASSWORD'),
      });

      this.token = data.data.token;
      this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000); // 23 soat
      return this.token!;
    } catch (error) {
      this.logger.error('Eskiz auth xatosi:', error);
      throw new InternalServerErrorException('SMS xizmati vaqtincha ishlamayapti');
    }
  }

  async send(phone: string, message: string): Promise<void> {
    const token = await this.getToken();
    // +998901234567 → 998901234567
    const normalizedPhone = phone.replace('+', '');

    try {
      await axios.post(
        `${this.baseUrl}/message/sms/send`,
        {
          mobile_phone: normalizedPhone,
          message,
          from: this.config.get('ESKIZ_FROM', '4546'),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      this.logger.log(`✅ SMS yuborildi: ${phone}`);
    } catch (error) {
      this.logger.error(`SMS yuborishda xato [${phone}]:`, error);
      throw new InternalServerErrorException('SMS yuborib bo\'lmadi');
    }
  }
}
