import { Injectable } from '@nestjs/common';
import { FeatureDisabledException } from '../../common/exceptions/feature-disabled.exception.js';
import { ListOrdersDto } from './dto/list-orders.dto.js';

@Injectable()
export class OrdersService {
  constructor() {}

  async list(_query: ListOrdersDto) {
    throw new FeatureDisabledException('Orders endpoint');
  }
}
