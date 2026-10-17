import { Injectable } from '@nestjs/common';
import { TradeRepository } from './trade.repository.js';
import { ListTradesDto } from './dto/list-trades.dto.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class TradesService {
  constructor(
    private readonly repo: TradeRepository,
    private readonly prismaService: PrismaService,
  ) {}

  async list(query: ListTradesDto) {
    this.prismaService.assertDatabaseAvailable();
    return this.repo.findAll(query);
  }
}
