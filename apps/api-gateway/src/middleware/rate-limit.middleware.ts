import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private requests: Map<string, { count: number; resetAt: number }> = new Map();

  constructor(private configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Get identifier (user ID if authenticated, otherwise IP)
    let identifier: string;

    if (req.headers['authorization']) {
      // Try to extract user ID from token (simplified, in production decode JWT)
      identifier = `user-${req.headers['authorization']?.substring(0, 20)}`;
    } else {
      identifier = `ip-${req.ip}`;
    }

    // Determine limits based on role (if available from token)
    let limit: number;
    let ttl: number;

    if (req.headers['x-user-role'] === 'seller') {
      limit = this.configService.get('GATEWAY_RATE_LIMIT_SELLER_MAX', 1000);
      ttl = this.configService.get('GATEWAY_RATE_LIMIT_WINDOW', 60000);
    } else {
      limit = this.configService.get('GATEWAY_RATE_LIMIT_MAX', 100);
      ttl = this.configService.get('GATEWAY_RATE_LIMIT_WINDOW', 60000);
    }

    const now = Date.now();
    const record = this.requests.get(identifier);

    if (!record || now > record.resetAt) {
      // New window
      this.requests.set(identifier, {
        count: 1,
        resetAt: now + ttl,
      });
      next();
      return;
    }

    if (record.count >= limit) {
      // Rate limit exceeded
      const resetInSeconds = Math.ceil((record.resetAt - now) / 1000);
      this.logger.warn(`Rate limit exceeded for ${identifier}`);

      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

      res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later.',
        error: {
          code: 'SYS_003',
          details: `Maximum ${limit} requests per ${ttl / 1000} seconds. Try again in ${resetInSeconds} seconds.`,
        },
      });
      return;
    }

    // Increment counter
    record.count++;
    this.requests.set(identifier, record);

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', limit - record.count);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

    next();
  }
}
