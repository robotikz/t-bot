import { MarketInstrument } from './scanner.service';

export interface ExecutionMarketResolution {
  analysisSymbol: string;
  baseAsset: string;
  analysisQuote: string;
  executionSymbol: string;
  executionMarket: string;
  executionQuote: 'USDC';
  executionAvailable: boolean;
  reason?: string;
}

interface NormalizedMarketInstrument {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  status: string;
}

const UNKNOWN = 'UNKNOWN';
const USDC_QUOTE = 'USDC';

export class ExecutionMarketResolver {
  private readonly symbolToInstrument = new Map<string, NormalizedMarketInstrument>();
  private readonly usdcExecutionByBase = new Map<string, string>();
  private readonly knownQuotes: string[];

  constructor(instruments: MarketInstrument[]) {
    const normalized = this.normalizeInstruments(instruments);

    for (const instrument of normalized) {
      const current = this.symbolToInstrument.get(instrument.symbol);
      if (!current || (current.status !== 'TRADING' && instrument.status === 'TRADING')) {
        this.symbolToInstrument.set(instrument.symbol, instrument);
      }

      if (instrument.quoteCoin !== USDC_QUOTE || instrument.status !== 'TRADING') {
        continue;
      }

      const existing = this.usdcExecutionByBase.get(instrument.baseCoin);
      if (!existing) {
        this.usdcExecutionByBase.set(instrument.baseCoin, instrument.symbol);
      }
    }

    this.knownQuotes = [...new Set(normalized.map((item) => item.quoteCoin).filter(Boolean))]
      .sort((left, right) => right.length - left.length);

    if (!this.knownQuotes.includes('USDT')) {
      this.knownQuotes.push('USDT');
    }
    if (!this.knownQuotes.includes(USDC_QUOTE)) {
      this.knownQuotes.push(USDC_QUOTE);
    }
  }

  resolveExecutionMarket(symbol: string): ExecutionMarketResolution {
    const analysisSymbol = (symbol ?? '').trim().toUpperCase();

    if (!analysisSymbol) {
      return this.unavailable(analysisSymbol, 'Malformed symbol: empty input.');
    }

    if (this.symbolToInstrument.size === 0) {
      return this.unavailable(analysisSymbol, 'Missing instrument data: unable to resolve execution market.');
    }

    const exact = this.symbolToInstrument.get(analysisSymbol);
    const parsed = exact
      ? {
          baseAsset: exact.baseCoin,
          analysisQuote: exact.quoteCoin,
        }
      : this.parseFromKnownQuotes(analysisSymbol);

    if (!parsed) {
      return this.unavailable(analysisSymbol, 'Malformed symbol: unable to determine base/quote assets.');
    }

    const executionSymbol = this.usdcExecutionByBase.get(parsed.baseAsset) ?? '';
    const executionAvailable = executionSymbol.length > 0;

    if (!executionAvailable) {
      return {
        analysisSymbol,
        baseAsset: parsed.baseAsset,
        analysisQuote: parsed.analysisQuote,
        executionSymbol: '',
        executionMarket: '',
        executionQuote: USDC_QUOTE,
        executionAvailable: false,
        reason: `No trading USDC execution market found for base asset ${parsed.baseAsset}.`,
      };
    }

    return {
      analysisSymbol,
      baseAsset: parsed.baseAsset,
      analysisQuote: parsed.analysisQuote,
      executionSymbol,
      executionMarket: executionSymbol,
      executionQuote: USDC_QUOTE,
      executionAvailable: true,
    };
  }

  private unavailable(analysisSymbol: string, reason: string): ExecutionMarketResolution {
    return {
      analysisSymbol,
      baseAsset: UNKNOWN,
      analysisQuote: UNKNOWN,
      executionSymbol: '',
      executionMarket: '',
      executionQuote: USDC_QUOTE,
      executionAvailable: false,
      reason,
    };
  }

  private parseFromKnownQuotes(symbol: string): { baseAsset: string; analysisQuote: string } | null {
    for (const quote of this.knownQuotes) {
      if (!symbol.endsWith(quote)) {
        continue;
      }

      const baseAsset = symbol.slice(0, -quote.length).trim().toUpperCase();
      if (!baseAsset) {
        continue;
      }

      return { baseAsset, analysisQuote: quote };
    }

    return null;
  }

  private normalizeInstruments(instruments: MarketInstrument[]): NormalizedMarketInstrument[] {
    return instruments
      .map((item) => ({
        symbol: (item.symbol ?? '').trim().toUpperCase(),
        baseCoin: (item.baseCoin ?? '').trim().toUpperCase(),
        quoteCoin: (item.quoteCoin ?? '').trim().toUpperCase(),
        status: (item.status ?? '').trim().toUpperCase(),
      }))
      .filter((item) => item.symbol.length > 0 && item.baseCoin.length > 0 && item.quoteCoin.length > 0);
  }
}

export function createExecutionMarketResolver(instruments: MarketInstrument[]): ExecutionMarketResolver {
  return new ExecutionMarketResolver(instruments);
}
