import { Injectable } from '@nestjs/common';
import { FeatureDisabledException } from '../../common/exceptions/feature-disabled.exception.js';
import { ListTradesDto } from './dto/list-trades.dto.js';

@Injectable()
export class TradesService {
  constructor() {}

  async list(_query: ListTradesDto) {
    throw new FeatureDisabledException('Trades endpoint');
  }
}
