import { Injectable } from '@nestjs/common';
import { CandleRepository } from './candle.repository.js';
import { ListCandlesDto } from './dto/list-candles.dto.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class CandlesService {
  constructor(
    private readonly repo: CandleRepository,
    private readonly prismaService: PrismaService,
  ) {}

  async list(query: ListCandlesDto) {
    this.prismaService.assertDatabaseAvailable();
    return this.repo.findMany(query);
  }
}
