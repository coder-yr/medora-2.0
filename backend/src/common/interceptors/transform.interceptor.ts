import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import { ApiResponse } from '../types/api-response.interface';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const req = context.switchToHttp().getRequest<Request>();
    const correlationId = req.correlationId || 'unknown';

    return next.handle().pipe(
      map((data) => {
        // If data is already wrapped or null/void, format cleanly
        if (data && typeof data === 'object' && 'success' in data && 'correlationId' in data) {
          return data;
        }

        return {
          success: true,
          data: data !== undefined ? data : null,
          timestamp: new Date().toISOString(),
          correlationId,
        };
      }),
    );
  }
}
