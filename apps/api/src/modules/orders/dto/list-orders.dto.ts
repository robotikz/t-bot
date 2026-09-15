import { IsOptional, IsString, IsIn } from 'class-validator';
import { OrderStatus, ExchangeName } from '../../../common/enums.js';

export class ListOrdersDto {
  @IsOptional()
  @IsIn(Object.values(ExchangeName))
  exchange?: ExchangeName;

  @IsOptional()
  @IsIn(Object.values(OrderStatus))
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  symbol?: string;
}
