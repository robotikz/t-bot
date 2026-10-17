import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import PrismaClientPkg from '@prisma/client';
import { ConfigService } from '../modules/config/config.service.js';
import { DatabaseUnavailableException } from './database-unavailable.exception.js';

export type DatabaseStatus = 'disabled' | 'disconnected' | 'connected';

@Injectable()
export class PrismaService extends PrismaClientPkg.PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly databaseUrl: string;
  private databaseStatus: DatabaseStatus;

  constructor(private readonly config: ConfigService) {
    const configuredDatabaseUrl = config.getString('DATABASE_URL', '').trim();
    const hasDatabaseUrl = configuredDatabaseUrl.length > 0;

    super(
      hasDatabaseUrl
        ? {
            datasources: {
              db: {
                url: configuredDatabaseUrl,
              },
            },
          }
        : {},
    );

    this.databaseUrl = configuredDatabaseUrl;
    this.databaseStatus = hasDatabaseUrl ? 'disconnected' : 'disabled';
  }

  async onModuleInit() {
    if (!this.databaseUrl) {
      this.logger.log('Database disabled; continuing without Prisma connection', PrismaService.name);
      return;
    }

    try {
      await this.$connect();
      this.databaseStatus = 'connected';
      this.logger.log('Database connection established', PrismaService.name);
    } catch (error) {
      this.databaseStatus = 'disconnected';
      this.logger.error(
        'Database connection failed',
        error instanceof Error ? error.stack : undefined,
        PrismaService.name,
      );
    }
  }

  async onModuleDestroy() {
    if (!this.databaseUrl) {
      return;
    }

    try {
      await this.$disconnect();
      this.logger.log('Database connection closed', PrismaService.name);
    } catch (error) {
      void error;
      this.logger.warn('Database disconnect failed', PrismaService.name);
    }
  }

  getDatabaseStatus(): DatabaseStatus {
    return this.databaseStatus;
  }

  isDatabaseAvailable(): boolean {
    return this.databaseStatus === 'connected';
  }

  assertDatabaseAvailable() {
    if (this.databaseStatus === 'connected') {
      return;
    }

    throw new DatabaseUnavailableException(this.databaseStatus);
  }

  async ping(): Promise<DatabaseStatus> {
    if (this.databaseStatus !== 'connected') {
      return this.databaseStatus;
    }

    try {
      await this.$queryRaw`SELECT 1 AS ok`;
      return this.databaseStatus;
    } catch {
      this.databaseStatus = 'disconnected';
      return this.databaseStatus;
    }
  }
}
