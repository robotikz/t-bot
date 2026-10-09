import type { FastifyInstance } from 'fastify';
import type { SignalizerService } from './signalizer.service.js';

export function registerSignalizerRoutes(app: FastifyInstance, signalizerService: SignalizerService): void {
  app.post('/api/signalizer/scan', async () => {
    const data = await signalizerService.scan();
    return { data };
  });

  app.post('/api/signalizer/analyze', async (request) => {
    type AnalyzeBody = { symbol?: string; signal?: unknown };
    const body = (request.body ?? {}) as AnalyzeBody;
    // basic validation: symbol must be uppercase alphanumeric, optional USDT/USDC
    const symbol = typeof body.symbol === 'string' ? body.symbol.trim().toUpperCase() : undefined;
    const SYMBOL_REGEX = /^[A-Z0-9]+(?:USDT|USDC)?$/;
    if (symbol && !SYMBOL_REGEX.test(symbol)) {
      return { statusCode: 400, error: 'Bad Request', message: 'Invalid symbol format' };
    }

    let signal: Parameters<SignalizerService['analyze']>[0]['signal'] | undefined = undefined;
    if (typeof body.signal === 'object' && body.signal !== null) {
      signal = body.signal as Parameters<SignalizerService['analyze']>[0]['signal'];
    }

    const input: Parameters<SignalizerService['analyze']>[0] = {
      ...(symbol ? { symbol } : {}),
      ...(signal ? { signal } : {})
    };
    const data = await signalizerService.analyze(input);
    return { data };
  });
}
