// src/modules/files/files.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

type FileFolder = 'avatars' | 'receipts';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private supabase: SupabaseClient;

  constructor(private config: ConfigService) {
    this.supabase = createClient(
      this.config.get<string>('SUPABASE_URL')!,
      this.config.get<string>('SUPABASE_SERVICE_KEY')!,
    );
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: FileFolder,
    userId: string,
  ): Promise<{ url: string; path: string }> {
    // Validatsiya
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Faqat JPEG, PNG yoki WEBP formatdagi rasm yuklash mumkin');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('Fayl hajmi 5MB dan oshmasligi kerak');
    }

    // Noyob fayl nomi
    const ext = file.originalname.split('.').pop();
    const fileName = `${userId}/${uuidv4()}.${ext}`;
    const filePath = `${folder}/${fileName}`;

    const { error } = await this.supabase.storage
      .from('hisobchi')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      this.logger.error('Supabase Storage xatosi:', error);
      throw new BadRequestException('Fayl yuklab bo\'lmadi');
    }

    // Public URL olish
    const { data } = this.supabase.storage
      .from('hisobchi')
      .getPublicUrl(filePath);

    return { url: data.publicUrl, path: filePath };
  }

  async deleteFile(filePath: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from('hisobchi')
      .remove([filePath]);

    if (error) {
      this.logger.error("Faylni o'chirishda xato:", error);
    }
  }
}
