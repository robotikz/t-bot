import { loadConfig } from './config/config.js';
import { startServer } from './server.js';
import { logger } from './shared/utils/logger.js';

const config = loadConfig();

startServer({ config }).catch((error: unknown) => {
  logger.error('failed to start scanner server', {
    error: error instanceof Error ? error.message : 'unknown error'
  });
  process.exitCode = 1;
});
