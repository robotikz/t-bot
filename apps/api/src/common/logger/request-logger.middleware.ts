import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AppLoggerService } from './app-logger.service.js';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: AppLoggerService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    const startedAt = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startedAt;
      const message = `${method} ${originalUrl} ${res.statusCode} ${duration}ms`;

      if (res.statusCode >= 500) {
        this.logger.error(message, undefined, 'HTTP');
        return;
      }

      this.logger.log(message, 'HTTP');
    });

    next();
  }
}
