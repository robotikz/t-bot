import { Injectable } from '@nestjs/common';
import { FeatureDisabledException } from '../../common/exceptions/feature-disabled.exception.js';
import { ListCandlesDto } from './dto/list-candles.dto.js';

@Injectable()
export class CandlesService {
  constructor() {}

  async list(_query: ListCandlesDto) {
    throw new FeatureDisabledException('Candles endpoint');
  }
}
