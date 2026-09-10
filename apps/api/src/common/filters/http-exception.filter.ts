import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppLoggerService } from '../logger/app-logger.service.js';

@Catch()
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload =
      exception instanceof HttpException
        ? (exception.getResponse() as Record<string, unknown> | string)
        : { message: 'Internal server error' };

    const message = this.extractMessage(payload);

    this.logger.error(
      message,
      exception instanceof Error ? exception.stack : undefined,
      HttpExceptionFilter.name,
    );

    response.status(status).json({
      success: false,
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
      message,
    });
  }

  private extractMessage(payload: Record<string, unknown> | string): string {
    if (typeof payload === 'string') {
      return payload;
    }

    if (Array.isArray(payload.message)) {
      return payload.message.join(', ');
    }

    if (typeof payload.message === 'string') {
      return payload.message;
    }

    return 'Internal server error';
  }
}
