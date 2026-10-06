import type { FastifyInstance } from 'fastify';
import type { MarketService } from './market.service.js';
import { ValidationError } from '../../shared/errors/app-error.js';
import type { Timeframe } from './market.types.js';

function parseTimeframe(input: string | undefined): Timeframe {
  if (!input || input === '1h') return '1h';
  if (input === '15m') return '15m';
  throw new ValidationError('INVALID_TIMEFRAME', `Unsupported timeframe: ${input}`);
}

export function registerMarketRoutes(app: FastifyInstance, marketService: MarketService): void {
  app.get('/api/markets/quote-coins', async () => {
    const data = await marketService.getAvailableQuoteCoins();
    return { count: data.length, data };
  });

  app.get('/api/markets', async (request) => {
    const query = request.query as { quoteCoin?: string };
    const quoteCoin = (query.quoteCoin ?? 'USDT').trim().toUpperCase();

    if (!quoteCoin) {
      throw new ValidationError('INVALID_QUOTE_COIN', 'quoteCoin must be a non-empty string');
    }

    const data = await marketService.getMarketsByQuoteCoin(quoteCoin);
    return { count: data.length, data };
  });

  app.get('/api/market/:symbol', async (request) => {
    const params = request.params as { symbol: string };
    const symbol = params.symbol.toUpperCase();

    const [ticker, markets] = await Promise.all([
      marketService.getMarketTicker(symbol),
      marketService.getUSDTMarkets()
    ]);

    const instrument = markets.find((item) => item.symbol === symbol);
    if (!instrument) {
      throw new ValidationError('INVALID_SYMBOL', `Unknown symbol: ${symbol}`);
    }

    return { symbol, instrument, ticker };
  });

  app.get('/api/market/:symbol/candles', async (request) => {
    const params = request.params as { symbol: string };
    const query = request.query as { timeframe?: string; limit?: string };

    const symbol = params.symbol.toUpperCase();
    const timeframe = parseTimeframe(query.timeframe);
    const limit = query.limit ? Number(query.limit) : undefined;

    if (limit !== undefined && (!Number.isFinite(limit) || limit < 100 || limit > 200)) {
      throw new ValidationError('INVALID_LIMIT', 'Limit must be between 100 and 200');
    }

    const candles = await marketService.getCandles(symbol, timeframe, limit);
    return { symbol, timeframe, count: candles.length, candles };
  });
}
