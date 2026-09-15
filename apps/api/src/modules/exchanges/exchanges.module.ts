import { Module } from '@nestjs/common';
import { ExchangesController } from './exchanges.controller.js';
import { ExchangesService } from './exchanges.service.js';
import { ExchangeRepository } from './exchange.repository.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ExchangesController],
  providers: [ExchangesService, ExchangeRepository],
  exports: [ExchangesService],
})
export class ExchangesModule {}
