import { Injectable } from '@nestjs/common';
import { CandleRepository } from './candle.repository.js';
import { ListCandlesDto } from './dto/list-candles.dto.js';

@Injectable()
export class CandlesService {
  constructor(private readonly repo: CandleRepository) {}

  async list(query: ListCandlesDto) {
    return this.repo.findMany(query);
  }
}
