import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, headers } = request;
    const userId = request.user?.sub || 'anonymous';
    const requestId = headers['x-request-id'] || 'unknown';
    const startTime = Date.now();

    this.logger.debug(`[${requestId}] ${method} ${url} - User: ${userId} - IP: ${ip}`);

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.debug(`[${requestId}] ${method} ${url} - ${duration}ms - Success`);
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            `[${requestId}] ${method} ${url} - ${duration}ms - Error: ${error.message}`,
            error.stack,
          );
        },
      }),
    );
  }
}