import type { MarketInstrument, MarketTicker } from '@trading-platform/shared';
import { ValidationError } from '../../shared/errors/app-error.js';
import type { MarketService } from '../market/market.service.js';
import type { Candle, Timeframe } from '../market/market.types.js';
import {
  TIMEFRAME_MS,
  type BacktestTimeframe,
  type HistoricalDataset,
  type RawCandle
} from './backtest.types.js';

const HOUR_MS = TIMEFRAME_MS['1h'];
const DAY_HOURS = 24;

type ReplayedMarketApi = Pick<
  MarketService,
  | 'getMarkets'
  | 'getMarketsByQuoteCoin'
  | 'getUSDTMarkets'
  | 'getUSDCMarkets'
  | 'getAvailableQuoteCoins'
  | 'getTickers'
  | 'getMarketTicker'
  | 'getCandles'
>;

/** Index of the first element with timestamp + tfMs > asOfMs (i.e. count of candles closed at asOfMs). */
function closedCount(candles: readonly RawCandle[], tfMs: number, asOfMs: number): number {
  let lo = 0;
  let hi = candles.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const candle = candles[mid];
    if (candle && candle.timestamp + tfMs <= asOfMs) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export type TickerUnavailableReason =
  | 'NO_SERIES'
  | 'NO_CLOSED_CANDLES'
  | 'STALE_PRICE_CANDLE'
  | 'INCOMPLETE_24H_HOURLY_WINDOW';

/**
 * Replays the public MarketService surface from a stored dataset.
 *
 * Everything returned is a pure function of (dataset, asOfMs) and only ever includes
 * candles that are fully closed at asOfMs:
 *  - price           = close of the last closed 15m candle (never a live ticker);
 *  - turnover24h     = sum of `turnover` over the 24 closed hourly candles ending at the
 *                      hour boundary at/below asOf. APPROXIMATION: not identical to Bybit's
 *                      historical 24h ticker value (which is not available);
 *  - change24hPercent= (price / close of the hourly candle that ended 24h before that
 *                      boundary - 1) * 100;
 *  - high24h/low24h/volume24h from the same 24 hourly candles;
 *  - bid/ask         = unavailable, therefore omitted.
 * Missing hourly candles make the ticker unavailable; nothing is interpolated.
 *
 * The instrument universe is the CURRENT live instrument list: delisted pairs are
 * absent (survivorship bias), and pairs listed later simply lack candles before listing.
 */
export class HistoricalMarketService implements ReplayedMarketApi {
  private asOfMs: number | null = null;

  constructor(private readonly dataset: HistoricalDataset) {}

  setAsOf(asOfMs: number): void {
    if (!Number.isFinite(asOfMs)) throw new Error('asOfMs must be finite');
    this.asOfMs = asOfMs;
  }

  get currentAsOf(): number {
    if (this.asOfMs === null) throw new Error('HistoricalMarketService: setAsOf() must be called before use');
    return this.asOfMs;
  }

  async getMarkets(): Promise<MarketInstrument[]> {
    return [...this.dataset.instruments];
  }

  async getMarketsByQuoteCoin(quoteCoin: string): Promise<MarketInstrument[]> {
    const normalized = quoteCoin.toUpperCase();
    return this.dataset.instruments.filter((i) => i.quoteCoin.toUpperCase() === normalized);
  }

  async getUSDTMarkets(): Promise<MarketInstrument[]> {
    return this.getMarketsByQuoteCoin('USDT');
  }

  async getUSDCMarkets(): Promise<MarketInstrument[]> {
    return this.getMarketsByQuoteCoin('USDC');
  }

  async getAvailableQuoteCoins(): Promise<string[]> {
    return [...new Set(this.dataset.instruments.map((i) => i.quoteCoin.toUpperCase()))].sort();
  }

  async getTickers(): Promise<MarketTicker[]> {
    const tickers: MarketTicker[] = [];
    for (const instrument of this.dataset.instruments) {
      const result = this.buildTicker(instrument.symbol);
      if ('ticker' in result) tickers.push(result.ticker);
    }
    return tickers;
  }

  async getMarketTicker(symbol: string): Promise<MarketTicker> {
    const result = this.buildTicker(symbol);
    if ('ticker' in result) return result.ticker;
    throw new ValidationError('INVALID_SYMBOL', `No historical ticker for ${symbol}: ${result.reason}`);
  }

  tickerUnavailableReason(symbol: string): TickerUnavailableReason | null {
    const result = this.buildTicker(symbol);
    return 'reason' in result ? result.reason : null;
  }

  /** Mirrors MarketService.getCandles: clamp limit to [100, 200], newest `limit` closed candles, ascending. */
  async getCandles(symbol: string, timeframe: Timeframe, limit?: number): Promise<Candle[]> {
    const capped = Math.max(100, Math.min(limit ?? 200, 200));
    const candles = this.closedCandles(symbol, timeframe, capped);
    if (candles.length < 2) {
      throw new ValidationError('INSUFFICIENT_CANDLES', `Insufficient candles for ${symbol}`);
    }
    return candles.map((c) => ({ ...c, isClosed: true }));
  }

  /** Count of missing candles inside the newest `limit` closed candles' span (for reporting only). */
  missingInWindow(symbol: string, timeframe: BacktestTimeframe, limit: number): number {
    const candles = this.closedCandles(symbol, timeframe, limit);
    const first = candles[0];
    const last = candles[candles.length - 1];
    if (!first || !last) return 0;
    const tf = TIMEFRAME_MS[timeframe];
    return (last.timestamp - first.timestamp) / tf + 1 - candles.length;
  }

  /** Close of the last 15m candle closed at the current as-of time, or null. */
  lastClosedPrice(symbol: string): number | null {
    const set = this.dataset.series.get(symbol);
    if (!set) return null;
    const end = closedCount(set['15m'], TIMEFRAME_MS['15m'], this.currentAsOf);
    return set['15m'][end - 1]?.close ?? null;
  }

  /** Newest `limit` candles that are fully closed at the current as-of time (ascending). */
  closedCandles(symbol: string, timeframe: Timeframe, limit: number): RawCandle[] {
    if (timeframe !== '15m' && timeframe !== '1h') {
      throw new ValidationError('INVALID_SYMBOL', `Unsupported replay timeframe ${timeframe}`);
    }
    const set = this.dataset.series.get(symbol);
    if (!set) throw new ValidationError('INVALID_SYMBOL', `Unknown symbol: ${symbol}`);
    const source = set[timeframe];
    const end = closedCount(source, TIMEFRAME_MS[timeframe], this.currentAsOf);
    return source.slice(Math.max(0, end - limit), end);
  }

  private buildTicker(
    symbol: string
  ): { ticker: MarketTicker } | { reason: TickerUnavailableReason } {
    const asOf = this.currentAsOf;
    const set = this.dataset.series.get(symbol);
    if (!set) return { reason: 'NO_SERIES' };

    const end15 = closedCount(set['15m'], TIMEFRAME_MS['15m'], asOf);
    const last15 = set['15m'][end15 - 1];
    if (!last15) return { reason: 'NO_CLOSED_CANDLES' };
    if (last15.timestamp + TIMEFRAME_MS['15m'] < asOf - TIMEFRAME_MS['15m']) {
      return { reason: 'STALE_PRICE_CANDLE' };
    }

    const boundary = Math.floor(asOf / HOUR_MS) * HOUR_MS;
    const hourly = set['1h'];
    const endH = closedCount(hourly, HOUR_MS, boundary);
    const window = hourly.slice(Math.max(0, endH - DAY_HOURS), endH);
    const reference = hourly[endH - DAY_HOURS - 1];
    const first = window[0];
    const lastH = window[window.length - 1];
    if (
      window.length !== DAY_HOURS ||
      !first ||
      !lastH ||
      !reference ||
      lastH.timestamp !== boundary - HOUR_MS ||
      first.timestamp !== boundary - DAY_HOURS * HOUR_MS ||
      reference.timestamp !== boundary - (DAY_HOURS + 1) * HOUR_MS ||
      reference.close <= 0
    ) {
      return { reason: 'INCOMPLETE_24H_HOURLY_WINDOW' };
    }

    let turnover = 0;
    let volume = 0;
    let high = Number.NEGATIVE_INFINITY;
    let low = Number.POSITIVE_INFINITY;
    for (const candle of window) {
      turnover += candle.turnover;
      volume += candle.volume;
      if (candle.high > high) high = candle.high;
      if (candle.low < low) low = candle.low;
    }

    return {
      ticker: {
        symbol,
        lastPrice: last15.close,
        change24hPercent: (last15.close / reference.close - 1) * 100,
        high24h: high,
        low24h: low,
        volume24h: volume,
        turnover24h: turnover,
        timestamp: asOf
      }
    };
  }
}
