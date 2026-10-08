import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/config.js';
import type { SignalizerService } from '../src/modules/signalizer/signalizer.service.js';

describe('signalizer api integration', () => {
  it('triggers manual signalizer scan endpoint', async () => {
    const signalizerService = {
      scan: vi.fn().mockResolvedValue({
        generatedAt: '2026-10-07T10:00:00.000Z',
        isRunning: false,
        skipped: false,
        count: 1,
        stateChangedCount: 0,
        signals: [
          {
            symbol: 'SOLUSDT',
            pairAnalyzed: 'SOLUSDT',
            targetBotPair: 'SOLUSDC',
            quoteAsset: 'USDT',
            usdcAvailable: true,
            state: 'WATCH',
            currentPrice: 130,
            price24hChangePercent: 1,
            turnover24h: 2_000_000,
            score: 70,
            reasons: ['PASSES_FILTERS'],
            rejectionReasons: [],
            generatedAt: '2026-10-07T10:00:00.000Z',
            stateChanged: false
          }
        ]
      })
    } as unknown as SignalizerService;

    const app = createApp({
      config: loadConfig(),
      services: { signalizerService }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/signalizer/scan'
    });

    expect(response.statusCode).toBe(200);

    const body = response.json() as { data: { count: number; signals: Array<{ symbol: string }> } };
    expect(body.data.count).toBe(1);
    expect(body.data.signals[0]?.symbol).toBe('SOLUSDT');

    await app.close();
  });

  it('returns ai analysis from analyze endpoint', async () => {
    const signalizerService = {
      scan: vi.fn(),
      analyze: vi.fn().mockResolvedValue({
        state: 'WATCH',
        symbol: 'SOLUSDT',
        targetBotPair: 'SOLUSDC',
        decision: 'WAIT',
        setup: {
          entryLow: 129,
          entryHigh: 131,
          gridLow: 126,
          gridHigh: 135,
          gridCount: 8,
          stopLoss: 124,
          takeProfit: 134,
          investment: 300,
          trailingStopPercent: 4,
          trailingUp: false
        },
        risk: 'MEDIUM',
        confidence: 75,
        reasons: ['waiting for 15m confirmation'],
        warnings: [],
        waitingFor: ['15M_CONFIRMATION']
      })
    } as unknown as SignalizerService;

    const app = createApp({
      config: loadConfig(),
      services: { signalizerService }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/signalizer/analyze',
      payload: { symbol: 'SOLUSDT' }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { state: string; symbol: string } };
    expect(body.data.state).toBe('WATCH');
    expect(body.data.symbol).toBe('SOLUSDT');

    await app.close();
  });
});
