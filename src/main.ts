// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppLogger } from './common/logger/logger.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Winston logger
  const logger = app.get(AppLogger);
  app.useLogger(logger);

  // Security
  app.use(helmet());
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global Filters & Interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new ResponseInterceptor());

  // Swagger (faqat development)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Hisobchi API')
      .setDescription("O'zbekiston shaxsiy moliya ilovasi — REST API + WebSocket")
      .setVersion('2.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT-auth')
      .addTag('Auth', 'SMS OTP va JWT autentifikatsiya')
      .addTag('Users', 'Foydalanuvchi profili')
      .addTag('Transactions', 'Xarajat va daromadlar')
      .addTag('Categories', 'Kategoriyalar')
      .addTag('Budgets', 'Byudjet va limitlar')
      .addTag('Analytics', 'Statistika va tahlil')
      .addTag('Notifications', 'Bildirishnomalar (Push + In-app)')
      .addTag('Files', 'Fayl yuklash (Supabase Storage)')
      .addTag('Telegram', 'Telegram bot integratsiya')
      .addTag('Admin', 'Admin panel (ROLE: ADMIN)')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    logger.log(`📚 Swagger: http://localhost:${process.env.PORT ?? 3000}/api/docs`, 'Bootstrap');
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`🚀 Hisobchi API: http://localhost:${port}/api/v1`, 'Bootstrap');
  logger.log(`🔌 WebSocket: ws://localhost:${port}/ws`, 'Bootstrap');
  logger.log(`🌍 Muhit: ${process.env.NODE_ENV ?? 'development'}`, 'Bootstrap');
}

bootstrap();
