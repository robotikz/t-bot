import { Controller, Get, Query } from '@nestjs/common';
import { MarketDataService } from './market-data.service.js';
import { ListMarketDataCandlesDto } from './dto/list-market-data-candles.dto.js';
import { ListMarketDataMarketsDto } from './dto/list-market-data-markets.dto.js';
import { MARKET_DATA_PUBLIC_TIMEFRAME_TO_DOMAIN_TIMEFRAME } from './market-data.constants.js';

@Controller('market-data')
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  private parseLimit(limit?: string | number) {
    if (limit === undefined) {
      return undefined;
    }

    return typeof limit === 'number' ? limit : Number.parseInt(limit, 10);
  }

  @Get('markets')
  async markets(@Query() query: ListMarketDataMarketsDto) {
    return this.marketDataService.getMarkets(query.broker);
  }

  @Get('candles')
  async candles(@Query() query: ListMarketDataCandlesDto) {
    return this.marketDataService.getCandles({
      brokerId: query.broker,
      symbol: query.symbol,
      timeframe: MARKET_DATA_PUBLIC_TIMEFRAME_TO_DOMAIN_TIMEFRAME[query.timeframe],
      limit: this.parseLimit(query.limit),
    });
  }

  @Get('candles/load')
  async loadCandles(@Query() query: ListMarketDataCandlesDto) {
    return this.marketDataService.loadCandles({
      brokerId: query.broker,
      symbol: query.symbol,
      timeframe: MARKET_DATA_PUBLIC_TIMEFRAME_TO_DOMAIN_TIMEFRAME[query.timeframe],
      limit: this.parseLimit(query.limit),
    });
  }
}
