import { ServiceUnavailableException } from '@nestjs/common';
import type { DatabaseStatus } from './prisma.service.js';

export class DatabaseUnavailableException extends ServiceUnavailableException {
  constructor(status: Exclude<DatabaseStatus, 'connected'>, context = 'database-backed feature') {
    super(`Database is ${status}; ${context} is unavailable`);
  }
}
