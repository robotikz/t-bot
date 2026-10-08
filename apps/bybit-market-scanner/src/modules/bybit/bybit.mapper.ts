import type { BybitInstrument, BybitKline, BybitTicker } from './bybit.types.js';
import type { Candle, MarketInstrument, MarketTicker, Timeframe } from '../market/market.types.js';
import { toNumber } from '../../shared/utils/math.js';
import { ValidationError } from '../../shared/errors/app-error.js';

export function timeframeToBybitInterval(timeframe: Timeframe): string {
  if (timeframe === '15m') return '15';
  if (timeframe === '4h') return '240';
  return '60';
}

export function mapBybitInstrument(instrument: BybitInstrument): MarketInstrument {
  const lotSizeFilter = instrument.lotSizeFilter;
  const priceFilter = instrument.priceFilter;
  const minOrderQty = instrument.minOrderQty ?? lotSizeFilter?.minOrderQty;
  const minOrderAmt = instrument.minOrderAmt ?? lotSizeFilter?.minOrderAmt;
  const tickSize = instrument.tickSize ?? priceFilter?.tickSize;

  return {
    symbol: instrument.symbol,
    baseCoin: instrument.baseCoin,
    quoteCoin: instrument.quoteCoin,
    status: instrument.status,
    ...(lotSizeFilter ? { lotSizeFilter } : {}),
    ...(priceFilter ? { priceFilter } : {}),
    ...(minOrderQty ? { minOrderQty } : {}),
    ...(minOrderAmt ? { minOrderAmt } : {}),
    ...(tickSize ? { tickSize } : {}),
    ...(instrument.basePrecision ? { basePrecision: instrument.basePrecision } : {}),
    ...(instrument.quotePrecision ? { quotePrecision: instrument.quotePrecision } : {})
  };
}

export function mapBybitTicker(ticker: BybitTicker, timestamp: number): MarketTicker {
  const lastPrice = toNumber(ticker.lastPrice);
  const changeRatio = toNumber(ticker.price24hPcnt);
  const high24h = toNumber(ticker.highPrice24h);
  const low24h = toNumber(ticker.lowPrice24h);
  const volume24h = toNumber(ticker.volume24h);
  const turnover24h = toNumber(ticker.turnover24h);

  if (
    [lastPrice, changeRatio, high24h, low24h, volume24h, turnover24h].some(
      (value) => !Number.isFinite(value)
    )
  ) {
    throw new ValidationError('MALFORMED_BYBIT_TICKER', `Malformed ticker: ${ticker.symbol}`);
  }

  const bidPrice = toNumber(ticker.bid1Price);
  const askPrice = toNumber(ticker.ask1Price);

  return {
    symbol: ticker.symbol,
    lastPrice,
    change24hPercent: changeRatio * 100,
    high24h,
    low24h,
    volume24h,
    turnover24h,
    ...(Number.isFinite(bidPrice) ? { bidPrice } : {}),
    ...(Number.isFinite(askPrice) ? { askPrice } : {}),
    timestamp
  };
}

function timeframeMs(timeframe: Timeframe): number {
  if (timeframe === '4h') return 4 * 60 * 60_000;
  return timeframe === '15m' ? 15 * 60_000 : 60 * 60_000;
}

export function mapBybitKline(kline: BybitKline, timeframe: Timeframe, nowMs: number): Candle {
  const [start, open, high, low, close, volume, turnover] = kline;

  const candle: Candle = {
    timestamp: toNumber(start),
    open: toNumber(open),
    high: toNumber(high),
    low: toNumber(low),
    close: toNumber(close),
    volume: toNumber(volume),
    turnover: toNumber(turnover),
    isClosed: false
  };

  if (
    [candle.timestamp, candle.open, candle.high, candle.low, candle.close, candle.volume, candle.turnover].some(
      (value) => !Number.isFinite(value)
    )
  ) {
    throw new ValidationError('MALFORMED_BYBIT_KLINE', 'Malformed kline payload from Bybit');
  }

  candle.isClosed = candle.timestamp + timeframeMs(timeframe) <= nowMs;
  return candle;
}

export function normalizeBybitKlines(
  klines: BybitKline[],
  timeframe: Timeframe,
  nowMs: number
): Candle[] {
  return [...klines].reverse().map((row) => mapBybitKline(row, timeframe, nowMs));
}
