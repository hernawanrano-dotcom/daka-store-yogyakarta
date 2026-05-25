import { Injectable, NestMiddleware, Logger, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthMiddleware.name);
  private readonly publicPaths = [
    '/api/v1/auth/register',
    '/api/v1/auth/login',
    '/api/v1/auth/refresh',
    '/api/v1/auth/forgot-password',
    '/api/v1/auth/reset-password',
    '/health',
    '/api/v1/courier/webhook',
    '/api/v1/payments/webhook',
  ];

  constructor(private configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Skip auth for public paths
    if (this.isPublicPath(req.path)) {
      return next();
    }

    const authHeader = req.headers['authorization'];

    if (!authHeader) {
      this.logger.warn(`Missing authorization header for ${req.path}`);
      throw new UnauthorizedException('Missing authorization token');
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      const secret = this.configService.get('JWT_SECRET');
      const decoded = jwt.verify(token, secret) as any;

      // Attach user info to request for downstream services
      req.headers['x-user-id'] = decoded.sub;
      req.headers['x-user-role'] = decoded.role;
      req.headers['x-device-id'] = decoded.deviceId;

      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        this.logger.warn(`Token expired for ${req.path}`);
        throw new UnauthorizedException('Token has expired');
      }

      this.logger.warn(`Invalid token for ${req.path}: ${error.message}`);
      throw new UnauthorizedException('Invalid token');
    }
  }

  private isPublicPath(path: string): boolean {
    return this.publicPaths.some((publicPath) => path.startsWith(publicPath));
  }
}
