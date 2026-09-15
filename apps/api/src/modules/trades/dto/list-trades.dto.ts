import { IsOptional, IsString, IsIn } from 'class-validator';
import { ExchangeName } from '../../../common/enums.js';

export class ListTradesDto {
  @IsOptional()
  @IsIn(Object.values(ExchangeName))
  exchange?: ExchangeName;

  @IsOptional()
  @IsString()
  symbol?: string;
}
