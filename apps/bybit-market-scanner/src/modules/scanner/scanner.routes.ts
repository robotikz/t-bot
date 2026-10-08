import type { FastifyInstance } from 'fastify';
import type { ScannerService } from './scanner.service.js';
import { ValidationError } from '../../shared/errors/app-error.js';
import type { Timeframe } from '../market/market.types.js';

function parseTimeframe(input: string | undefined, fallback: Timeframe): Timeframe {
  if (!input) return fallback;
  if (input === '1h' || input === '15m' || input === '4h') return input;
  throw new ValidationError('INVALID_TIMEFRAME', `Unsupported timeframe: ${input}`);
}

export function registerScannerRoutes(app: FastifyInstance, scannerService: ScannerService): void {
  app.get('/api/scanner', async (request) => {
    const query = request.query as {
      quoteCoin?: string;
      timeframe?: string;
      secondaryTimeframe?: string;
      limit?: string;
      minTurnover?: string;
    };

    const quoteCoin = (query.quoteCoin ?? 'USDT').trim().toUpperCase();
    if (!quoteCoin) {
      throw new ValidationError('INVALID_QUOTE_COIN', 'quoteCoin must be a non-empty string');
    }

    const timeframe = parseTimeframe(query.timeframe, '1h');
    const secondaryTimeframe = parseTimeframe(query.secondaryTimeframe, '15m');

    const limit = query.limit ? Number(query.limit) : undefined;
    if (limit !== undefined && (!Number.isFinite(limit) || limit < 1)) {
      throw new ValidationError('INVALID_LIMIT', 'limit must be a positive integer');
    }

    const minTurnover = query.minTurnover ? Number(query.minTurnover) : undefined;
    if (minTurnover !== undefined && (!Number.isFinite(minTurnover) || minTurnover < 0)) {
      throw new ValidationError('INVALID_MIN_TURNOVER', 'minTurnover must be a non-negative number');
    }

    const scanOptions: NonNullable<Parameters<ScannerService['scan']>[0]> = {
      quoteCoin,
      timeframe,
      secondaryTimeframe,
    };
    if (limit !== undefined) {
      scanOptions.limit = limit;
    }
    if (minTurnover !== undefined) {
      scanOptions.minTurnover = minTurnover;
    }

    const data = await scannerService.scan(scanOptions);
    return { data };
  });
}
