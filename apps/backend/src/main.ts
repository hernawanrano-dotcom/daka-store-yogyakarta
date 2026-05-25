import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const port = configService.get('APP_PORT', 3000);
  const nodeEnv = configService.get('NODE_ENV', 'development');

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // Middleware
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  app.use(compression());
  app.use(cookieParser());

  // CORS
  const corsOrigins = configService.get(
    'CORS_ORIGIN',
    'http://localhost:3001,http://localhost:3002,http://localhost:3003'
  );
  app.enableCors({
    origin: corsOrigins.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Device-ID'],
  });

  // Request ID middleware
  app.use((req, res, next) => {
    const requestId =
      req.headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  });

  await app.listen(port);

  console.log(`🚀 Backend server running on http://localhost:${port}`);
  console.log(`📝 Environment: ${nodeEnv}`);
  console.log(`🔐 API prefix: /api/v1`);
}

bootstrap();
