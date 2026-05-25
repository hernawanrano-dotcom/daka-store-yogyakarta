import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const requestId = request.headers?.['x-request-id'] || 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'SYS_001';
    let details = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      message = exceptionResponse.message || exception.message;

      // Map HTTP status to error code
      code = this.mapStatusToCode(status, message);
      details = exceptionResponse.error || null;
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(`[${requestId}] ${exception.stack}`);
    }

    response.status(status).json({
      success: false,
      message,
      error: {
        code,
        details,
      },
    });
  }

  private mapStatusToCode(status: number, message: string): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return 'AUTH_001';
      case HttpStatus.FORBIDDEN:
        return 'AUTH_003';
      case HttpStatus.NOT_FOUND:
        return 'RES_001';
      case HttpStatus.CONFLICT:
        return 'RES_002';
      case HttpStatus.BAD_REQUEST:
        if (message?.toLowerCase().includes('validation')) {
          return 'VAL_001';
        }
        return 'VAL_002';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'SYS_003';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'SYS_001';
      default:
        return 'SYS_001';
    }
  }
}
