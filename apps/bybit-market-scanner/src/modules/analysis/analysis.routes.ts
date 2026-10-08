import type { FastifyInstance } from 'fastify';
import type { AnalysisService } from './analysis.service.js';
import { ValidationError } from '../../shared/errors/app-error.js';
import type { Timeframe } from '../market/market.types.js';

function parseTimeframe(input: string | undefined): Timeframe {
  if (!input || input === '1h') return '1h';
  if (input === '15m') return '15m';
  if (input === '4h') return '4h';
  throw new ValidationError('INVALID_TIMEFRAME', `Unsupported timeframe: ${input}`);
}

export function registerAnalysisRoutes(app: FastifyInstance, analysisService: AnalysisService): void {
  app.get('/api/analysis/:symbol', async (request) => {
    const params = request.params as { symbol: string };
    const query = request.query as { timeframe?: string };

    const symbol = params.symbol.toUpperCase();
    const timeframe = parseTimeframe(query.timeframe);

    const data = await analysisService.analyzeSymbol(symbol, timeframe);
    return { data };
  });
}
