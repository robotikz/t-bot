import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '../modules/config/config.service.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly config: ConfigService) {
    super({
      datasources: {
        db: {
          url: config.getString(
            'DATABASE_URL',
            'postgresql://postgres:postgres@localhost:5432/trading_platform',
          ),
        },
      },
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connection established', PrismaService.name);
    } catch (error) {
      this.logger.error(
        'Database connection failed',
        error instanceof Error ? error.stack : undefined,
        PrismaService.name,
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database connection closed', PrismaService.name);
  }
}
