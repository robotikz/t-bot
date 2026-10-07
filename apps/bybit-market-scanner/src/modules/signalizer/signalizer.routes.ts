import type { FastifyInstance } from 'fastify';
import type { SignalizerService } from './signalizer.service.js';

export function registerSignalizerRoutes(app: FastifyInstance, signalizerService: SignalizerService): void {
  app.post('/api/signalizer/scan', async () => {
    const data = await signalizerService.scan();
    return { data };
  });
}
