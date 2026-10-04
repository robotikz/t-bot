import type { FastifyInstance } from 'fastify';
import { createApp, type CreateAppOptions } from './app.js';
import { logger } from './shared/utils/logger.js';

export async function startServer(options: CreateAppOptions = {}): Promise<FastifyInstance> {
  const app = createApp(options);
  const port = options.config?.port ?? 3000;

  await app.listen({ host: '0.0.0.0', port });
  logger.info('scanner server started', { port });

  return app;
}
