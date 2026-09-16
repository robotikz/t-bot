# ADR-0007: Broker-agnostic backtesting engine and first trading UI

## Status

Accepted

## Date

2026-09-16

## Context

Phase 8 introduced a broker-agnostic strategy layer that evaluates normalized candle data and emits unified analytical signals. Phase 9 needs historical replay, simulated execution, and a first useful trading UI without duplicating strategy logic or coupling backtesting to a specific broker adapter.

The platform must avoid look-ahead bias and keep a clean dependency direction:

Historical Candles
	↓
Backtesting Engine
	↓
Existing Strategy
	↓
Signals
	↓
Simulator
	↓
Metrics / Results

## Decision

- Introduce a dedicated `BacktestsModule` rather than putting execution logic into existing strategies or indicators
- Keep the backtesting engine broker-agnostic and strategy-driven:
  - input: normalized `Candle[]`
  - strategy evaluation: existing `StrategyRegistry`
  - output: serializable `BacktestResult`
- Reuse the Phase 8 strategy implementations directly; no separate EMA crossover or RSI backtest variants are allowed
- Route historical data through the existing market-data engine instead of calling Bybit APIs directly from backtest code
- Use an in-memory request/response backtest flow for Phase 9 and defer persistence of backtest runs
- Use a deterministic long-only simulator with the following rules:
  - one open position at a time
  - `BUY` while flat opens a long
  - `SELL` while long closes the long
  - duplicate `BUY` while long is ignored
  - `SELL` while flat is ignored
- Use explicit anti-look-ahead execution timing:
  - signal generated from candle $N$ close
  - execution filled at candle $N + 1$ open
  - if no next candle exists, an open position is closed at the final candle close by end-of-test policy
- Apply fees to both entry and exit notionals:
  - entry fee = entry price × quantity × fee rate
  - exit fee = exit price × quantity × fee rate
- Use full available cash for the initial long-only position size, constrained by fee-inclusive cost and with no leverage
- Record the equity curve on every processed candle using mark-to-market valuation at candle close
- Expose the result through `POST /api/backtests`
- Build the first trading UI inside the existing Angular application at `/trading`
- Use `lightweight-charts` for candlesticks, overlays, markers, zoom, pan, and responsive rendering

## Consequences

- Strategy logic stays portable across backtesting, future paper trading, and future live trading
- Look-ahead bias prevention is explicit and testable
- Market-data responsibilities stay inside the existing market-data engine and broker layer
- Backtest persistence is deferred until product workflows justify stored runs, history, or comparison features
- The first trading UI can visualize candles, indicators, signals, equity, and trades without moving business logic into the browser
- Current limitations remain intentional:
  - long-only
  - no leverage or margin
  - no short selling
  - no stop-loss / take-profit
  - no slippage or spread model
  - no optimization workflows
