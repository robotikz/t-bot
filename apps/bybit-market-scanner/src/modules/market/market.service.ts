import type { AppConfig } from '../../config/config.js';
import {
  mapBybitInstrument,
  mapBybitTicker,
  normalizeBybitKlines,
  timeframeToBybitInterval
} from '../bybit/bybit.mapper.js';
import type { BybitClient } from '../bybit/bybit.client.js';
import type { Candle, MarketInstrument, MarketTicker, Timeframe } from './market.types.js';
import { ValidationError } from '../../shared/errors/app-error.js';

export class MarketService {
  constructor(
    private readonly bybitClient: BybitClient,
    private readonly config: AppConfig
  ) {}

  async getUSDTMarkets(): Promise<MarketInstrument[]> {
    return this.getMarketsByQuoteCoin('USDT');
  }

  async getUSDCMarkets(): Promise<MarketInstrument[]> {
    return this.getMarketsByQuoteCoin('USDC');
  }

  async getMarkets(): Promise<MarketInstrument[]> {
    const instruments = await this.bybitClient.getSpotInstruments();

    return instruments
      .map(mapBybitInstrument)
      .filter((item) => item.status === 'Trading');
  }

  async getMarketsByQuoteCoin(quoteCoin: string): Promise<MarketInstrument[]> {
    const instruments = await this.bybitClient.getSpotInstruments();
    const normalizedQuoteCoin = quoteCoin.toUpperCase();

    return instruments
      .map(mapBybitInstrument)
      .filter(
        (item) => item.status === 'Trading' && item.quoteCoin.toUpperCase() === normalizedQuoteCoin
      );
  }

  async getAvailableQuoteCoins(): Promise<string[]> {
    const instruments = await this.bybitClient.getSpotInstruments();

    return [...new Set(
      instruments
        .map(mapBybitInstrument)
        .filter((item) => item.status === 'Trading')
        .map((item) => item.quoteCoin.trim().toUpperCase())
        .filter((quoteCoin) => quoteCoin.length > 0)
    )].sort((left, right) => left.localeCompare(right));
  }

  async getTickers(): Promise<MarketTicker[]> {
    const tickers = await this.bybitClient.getSpotTickers();
    const now = Date.now();
    return tickers.map((ticker) => mapBybitTicker(ticker, now));
  }

  async getMarketTicker(symbol: string): Promise<MarketTicker> {
    const directTicker = await this.bybitClient.getSpotTicker(symbol);

    if (directTicker) {
      return mapBybitTicker(directTicker, Date.now());
    }

    const tickers = await this.getTickers();
    const ticker = tickers.find((item) => item.symbol === symbol);
    if (!ticker) {
      throw new ValidationError('INVALID_SYMBOL', `Unknown symbol: ${symbol}`);
    }
    return ticker;
  }

  async getCandles(symbol: string, timeframe: Timeframe, limit?: number): Promise<Candle[]> {
    const capped = Math.max(100, Math.min(limit ?? this.config.analysisCandleLimit, 200));
    const interval = timeframeToBybitInterval(timeframe);
    const rows = await this.bybitClient.getKlines(symbol, interval, capped);
    const candles = normalizeBybitKlines(rows, timeframe, Date.now());
    if (candles.length < 2) {
      throw new ValidationError('INSUFFICIENT_CANDLES', `Insufficient candles for ${symbol}`);
    }
    return candles;
  }
}
