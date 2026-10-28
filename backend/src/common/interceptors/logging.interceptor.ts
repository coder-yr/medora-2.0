import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const correlationId = req.correlationId || 'unknown';
    const method = req.method;
    const url = req.originalUrl || req.url;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = res.statusCode;
          this.logger.log(`[${correlationId}] ${method} ${url} ${statusCode} +${duration}ms`);
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          const status = err.status || 500;
          this.logger.error(
            `[${correlationId}] ${method} ${url} ${status} +${duration}ms - ${err.message}`,
          );
        },
      }),
    );
  }
}
