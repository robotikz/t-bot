# Roadmap

## Current status

Phases 1–8 are implemented through a read-only, broker-agnostic strategy evaluation stack:

- broker abstractions and adapters
- market-data engine
- indicator engine (EMA/RSI)
- strategy registry and evaluation API

No order execution is implemented yet.

## Completed phases

- Phase 1: Platform foundation
- Phase 2: Core infrastructure
- Phase 3: Domain foundation
- Phase 4: Broker abstraction layer
- Phase 5: Bybit adapter (read-only)
- Phase 6: Trading212 adapter (read-only account scope)
- Phase 7: Market-data engine
- Phase 8: Strategy engine and signals

## Next planned phases

### Phase 9: Backtesting and first trading UI

- broker-agnostic historical replay over normalized candles
- deterministic simulated execution and long-only portfolio accounting
- performance metrics, equity curve, and trade history reporting
- first Angular trading/backtesting screen with candle chart and signal overlays

### Phase 10: Execution foundation (paper first)

- signal-to-order orchestration boundary
- paper-trading execution adapter
- execution audit trail and signal persistence
- initial position sizing hooks
- backtest result persistence if product needs justify it

### Phase 11: Risk and controls

- pre-trade risk checks
- position limits and exposure controls
- stop-loss/take-profit policy evaluation
- strategy-level guardrails

### Phase 12: Live operations

- scheduler/background workers for strategy runs
- broader market-data ingestion (streaming and repair)
- observability, alerting, and production hardening
- CI/CD and deployment workflows
