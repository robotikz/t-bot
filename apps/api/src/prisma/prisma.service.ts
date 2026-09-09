import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    try {
      await this.$connect();
      // eslint-disable-next-line no-console
      console.log('Prisma connected');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Prisma connection error', err);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
