import { Injectable } from '@nestjs/common';
import { FeatureDisabledException } from '../../common/exceptions/feature-disabled.exception.js';
import { ListExchangesDto } from './dto/list-exchanges.dto.js';

@Injectable()
export class ExchangesService {
  constructor() {}

  async list(_query: ListExchangesDto) {
    throw new FeatureDisabledException('Exchanges endpoint');
  }
}
