import { Injectable } from '@nestjs/common';
import { ExchangeRepository } from './exchange.repository.js';
import { ListExchangesDto } from './dto/list-exchanges.dto.js';

@Injectable()
export class ExchangesService {
  constructor(private readonly repo: ExchangeRepository) {}

  async list(query: ListExchangesDto) {
    return this.repo.findAll(query);
  }
}
