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
import { MonitoringService } from './modules/monitoring/monitoring.service.js';
import type { SignalizerNotifier } from './modules/monitoring/notifier.interface.js';
import { TelegramNotifier } from './modules/monitoring/telegram.notifier.js';

// Monitoring config via env
const MONITOR_ENABLED = process.env.MONITOR_ENABLED === 'true';
const SIGNALIZER_API_URL = process.env.SIGNALIZER_API_URL ?? 'http://localhost:3000';
const MONITOR_INTERVAL_MINUTES = process.env.MONITOR_INTERVAL_MINUTES ? Number(process.env.MONITOR_INTERVAL_MINUTES) : 15;

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
    new SignalizerService(marketService, scannerService, signalStateStore, config);

  app.setErrorHandler(handleHttpError);

  app.get('/api/health', async () => ({ status: 'ok' }));
  registerMarketRoutes(app, marketService);
  registerAnalysisRoutes(app, analysisService);
  registerScannerRoutes(app, scannerService);
  registerSignalizerRoutes(app, signalizerService);

  if (MONITOR_ENABLED) {
    try {
      // optionally wire Telegram notifier when enabled
      const TELEGRAM_ENABLED = process.env.TELEGRAM_ENABLED === 'true';
      const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
      let notifier: SignalizerNotifier | undefined = undefined;
      if (TELEGRAM_ENABLED && TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        notifier = new TelegramNotifier({ enabled: true, token: TELEGRAM_BOT_TOKEN, chatId: TELEGRAM_CHAT_ID });
      }

      const monitoring = new MonitoringService(signalizerService, SIGNALIZER_API_URL, notifier);
      monitoring.start(MONITOR_INTERVAL_MINUTES);
    } catch (err) {
      console.error('Failed to start monitoring', err);
    }
  }

  return app;
}
