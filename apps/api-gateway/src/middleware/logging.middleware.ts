import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const { method, originalUrl, ip } = req;
    const requestId = (req.headers['x-request-id'] as string) || 'unknown';
    const userId = req.headers['x-user-id'] || 'anonymous';

    // Log request
    this.logger.debug(`[${requestId}] → ${method} ${originalUrl} - User: ${userId} - IP: ${ip}`);

    // Log response on finish
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;

      if (statusCode >= 400) {
        this.logger.warn(
          `[${requestId}] ← ${method} ${originalUrl} - ${statusCode} - ${duration}ms`
        );
      } else {
        this.logger.debug(
          `[${requestId}] ← ${method} ${originalUrl} - ${statusCode} - ${duration}ms`
        );
      }
    });

    next();
  }
}
