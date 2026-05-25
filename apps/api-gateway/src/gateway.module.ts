import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { HttpModule } from '@nestjs/axios';

// Middleware
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';
import { AuthMiddleware } from './middleware/auth.middleware';
import { LoggingMiddleware } from './middleware/logging.middleware';
import { RequestIdMiddleware } from './middleware/request-id.middleware';

// Services
import { GatewayService } from './gateway.service';

// Controllers
import { GatewayController } from './gateway.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute default
      },
    ]),
    HttpModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        timeout: 30000,
        maxRedirects: 5,
        baseURL: configService.get('BACKEND_URL', 'http://localhost:3000'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [GatewayController],
  providers: [GatewayService],
})
export class GatewayModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestIdMiddleware, LoggingMiddleware, RateLimitMiddleware, AuthMiddleware)
      .forRoutes('*');
  }
}