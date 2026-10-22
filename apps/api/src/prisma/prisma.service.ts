import { Injectable } from '@nestjs/common';
import { DatabaseUnavailableException } from './database-unavailable.exception.js';

export type DatabaseStatus = 'disabled';

@Injectable()
export class PrismaService {
  constructor() {}

  getDatabaseStatus(): DatabaseStatus {
    return 'disabled';
  }

  isDatabaseAvailable(): boolean {
    return false;
  }

  assertDatabaseAvailable() {
    throw new DatabaseUnavailableException('disabled');
  }

  async ping(): Promise<DatabaseStatus> {
    return 'disabled';
  }
}
