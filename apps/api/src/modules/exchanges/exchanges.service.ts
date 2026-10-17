import { Injectable } from '@nestjs/common';
import { ExchangeRepository } from './exchange.repository.js';
import { ListExchangesDto } from './dto/list-exchanges.dto.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ExchangesService {
  constructor(
    private readonly repo: ExchangeRepository,
    private readonly prismaService: PrismaService,
  ) {}

  async list(query: ListExchangesDto) {
    this.prismaService.assertDatabaseAvailable();
    return this.repo.findAll(query);
  }
}
