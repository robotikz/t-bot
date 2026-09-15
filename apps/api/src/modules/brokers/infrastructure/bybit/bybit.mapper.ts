import { Candle, Instrument, Market, Timeframe } from '../../domain/types.js';
import {
  BybitInstrumentsInfoResult,
  BybitKlineResult,
  BybitSpotInstrument,
  BybitKlineTuple,
} from './bybit-api.types.js';
import {
  BybitMalformedResponseException,
  BybitUnsupportedTimeframeException,
} from './bybit.errors.js';
import { getBybitIntervalMs } from './bybit.constants.js';

function parseNumber(value: string | undefined, field: string): number {
  if (value === undefined || value === '') {
    throw new BybitMalformedResponseException(`missing ${field}`);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new BybitMalformedResponseException(`invalid ${field}`);
  }

  return parsed;
}

function mapInstrument(item: BybitSpotInstrument): Market & Instrument {
  return {
    symbol: item.symbol,
    baseAsset: item.baseCoin,
    quoteAsset: item.quoteCoin,
    active: item.status === 'Trading',
    status: item.status,
    tickSize: item.priceFilter?.tickSize ? parseNumber(item.priceFilter.tickSize, 'tickSize') : undefined,
    lotSize: item.lotSizeFilter?.qtyStep
      ? parseNumber(item.lotSizeFilter.qtyStep, 'qtyStep')
      : item.lotSizeFilter?.minOrderQty
        ? parseNumber(item.lotSizeFilter.minOrderQty, 'minOrderQty')
        : undefined,
  };
}

export function mapBybitMarketsResponse(result: BybitInstrumentsInfoResult): Market[] {
  if (!result || !Array.isArray(result.list)) {
    throw new BybitMalformedResponseException('missing instrument list');
  }

  return result.list.map((item) => ({
    symbol: item.symbol,
    baseAsset: item.baseCoin,
    quoteAsset: item.quoteCoin,
    active: item.status === 'Trading',
  }));
}

export function mapBybitInstrumentResponse(result: BybitInstrumentsInfoResult): Instrument | null {
  if (!result || !Array.isArray(result.list)) {
    throw new BybitMalformedResponseException('missing instrument list');
  }

  const [item] = result.list;
  return item ? mapInstrument(item) : null;
}

export function mapBybitCandlesResponse(
  result: BybitKlineResult,
  symbol: string,
  timeframe: Timeframe,
  intervalMs = getBybitIntervalMs(timeframe),
): Candle[] {
  if (!intervalMs) {
    throw new BybitUnsupportedTimeframeException(timeframe);
  }

  if (!result || !Array.isArray(result.list)) {
    throw new BybitMalformedResponseException('missing kline list');
  }

  return result.list
    .map((tuple: BybitKlineTuple) => {
      if (!Array.isArray(tuple) || tuple.length < 7) {
        throw new BybitMalformedResponseException('invalid kline tuple');
      }

      const openTimeMs = parseNumber(tuple[0], 'startTime');
      const open = parseNumber(tuple[1], 'openPrice');
      const high = parseNumber(tuple[2], 'highPrice');
      const low = parseNumber(tuple[3], 'lowPrice');
      const close = parseNumber(tuple[4], 'closePrice');
      const volume = parseNumber(tuple[5], 'volume');

      const openTime = new Date(openTimeMs);
      const closeTime = new Date(openTimeMs + intervalMs - 1);

      return {
        symbol,
        timeframe,
        openTime,
        closeTime,
        open,
        high,
        low,
        close,
        volume,
      };
    })
    .sort((left, right) => left.openTime.getTime() - right.openTime.getTime());
}
