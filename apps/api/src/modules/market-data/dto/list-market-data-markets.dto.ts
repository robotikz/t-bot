import { IsString } from 'class-validator';

export class ListMarketDataMarketsDto {
  @IsString()
  broker!: string;
}
