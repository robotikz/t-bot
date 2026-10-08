import type { FastifyInstance } from 'fastify';
import type { SignalizerService } from './signalizer.service.js';

export function registerSignalizerRoutes(app: FastifyInstance, signalizerService: SignalizerService): void {
  app.post('/api/signalizer/scan', async () => {
    const data = await signalizerService.scan();
    return { data };
  });

  app.post('/api/signalizer/analyze', async (request) => {
    const body = (request.body ?? {}) as {
      symbol?: string;
      signal?: Parameters<SignalizerService['analyze']>[0]['signal'];
    };
    const input: Parameters<SignalizerService['analyze']>[0] = {
      ...(typeof body.symbol === 'string' ? { symbol: body.symbol } : {}),
      ...(body.signal ? { signal: body.signal } : {})
    };
    const data = await signalizerService.analyze(input);
    return { data };
  });
}
