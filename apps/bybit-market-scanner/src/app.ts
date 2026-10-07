import Fastify, { type FastifyInstance } from 'fastify';
import { loadConfig, type AppConfig } from './config/config.js';
import { BybitClient } from './modules/bybit/bybit.client.js';
import { MarketService } from './modules/market/market.service.js';
import { registerMarketRoutes } from './modules/market/market.routes.js';
import { AnalysisService } from './modules/analysis/analysis.service.js';
import { registerAnalysisRoutes } from './modules/analysis/analysis.routes.js';
import { ScannerService } from './modules/scanner/scanner.service.js';
import { registerScannerRoutes } from './modules/scanner/scanner.routes.js';
import { SignalizerService } from './modules/signalizer/signalizer.service.js';
import { registerSignalizerRoutes } from './modules/signalizer/signalizer.routes.js';
import { InMemorySignalStateStore } from './modules/signalizer/state/signal-state.store.js';
import { handleHttpError } from './shared/http/error-handler.js';

export interface AppServices {
  bybitClient: BybitClient;
  marketService: MarketService;
  analysisService: AnalysisService;
  scannerService: ScannerService;
  signalizerService: SignalizerService;
}

export interface CreateAppOptions {
  config?: AppConfig;
  services?: Partial<AppServices>;
}

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const config = options.config ?? loadConfig();
  const app = Fastify({ logger: false });

  const bybitClient = options.services?.bybitClient ?? new BybitClient(config);
  const marketService = options.services?.marketService ?? new MarketService(bybitClient, config);
  const analysisService = options.services?.analysisService ?? new AnalysisService(marketService, config);
  const scannerService =
    options.services?.scannerService ?? new ScannerService(marketService, analysisService, config);
  const signalStateStore = new InMemorySignalStateStore();
  const signalizerService =
    options.services?.signalizerService ??
    new SignalizerService(marketService, scannerService, signalStateStore);

  app.setErrorHandler(handleHttpError);

  app.get('/api/health', async () => ({ status: 'ok' }));
  registerMarketRoutes(app, marketService);
  registerAnalysisRoutes(app, analysisService);
  registerScannerRoutes(app, scannerService);
  registerSignalizerRoutes(app, signalizerService);

  return app;
}
