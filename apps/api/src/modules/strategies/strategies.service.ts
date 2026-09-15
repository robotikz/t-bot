import { Injectable } from '@nestjs/common';
import { StrategyRepository } from './strategy.repository.js';
import { ListStrategiesDto } from './dto/list-strategies.dto.js';

@Injectable()
export class StrategiesService {
  constructor(private readonly repo: StrategyRepository) {}

  async list(query: ListStrategiesDto) {
    return this.repo.findAll(query);
  }
}
