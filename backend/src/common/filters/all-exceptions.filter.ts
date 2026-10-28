import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse } from '../types/api-response.interface';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId = request.correlationId || 'unknown';
    const isProduction = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errorName = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        message = (resObj.message as string | string[]) || exception.message;
        errorName = (resObj.error as string) || exception.name;
      }
    } else if (exception instanceof Error) {
      message = isProduction ? 'An unexpected internal error occurred' : exception.message;
      errorName = exception.name;
    }

    // Structured logging with correlation ID
    if (status >= 500) {
      this.logger.error(
        `[${correlationId}] ${request.method} ${request.url} - Error: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[${correlationId}] ${request.method} ${request.url} - ${status} ${Array.isArray(message) ? message.join('; ') : message}`,
      );
    }

    const errorPayload: ApiResponse<never> = {
      success: false,
      error: {
        statusCode: status,
        message,
        error: errorName,
      },
      timestamp: new Date().toISOString(),
      correlationId,
    };

    response.status(status).json(errorPayload);
  }
}
