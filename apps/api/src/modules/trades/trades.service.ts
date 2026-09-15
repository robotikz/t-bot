import { Injectable } from '@nestjs/common';
import { TradeRepository } from './trade.repository.js';
import { ListTradesDto } from './dto/list-trades.dto.js';

@Injectable()
export class TradesService {
  constructor(private readonly repo: TradeRepository) {}

  async list(query: ListTradesDto) {
    return this.repo.findAll(query);
  }
}
