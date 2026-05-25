import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    timestamp?: string;
  };
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => {
        // If response already has success field (from backend), return as is
        if (data && data.success !== undefined) {
          return data;
        }

        // Detect pagination
        const isPaginated = data && data.meta && Array.isArray(data.data);

        return {
          success: true,
          message: 'OK',
          data: isPaginated ? data.data : data,
          meta: isPaginated
            ? {
                page: data.meta.page,
                limit: data.meta.limit,
                total: data.meta.total,
                totalPages: data.meta.totalPages,
                timestamp: new Date().toISOString(),
              }
            : undefined,
        };
      })
    );
  }
}
