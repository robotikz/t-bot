# ADR-0006: Broker-agnostic strategy engine and unified signal model

## Status

Accepted

## Date

2026-09-16

## Context

The platform already has broker abstractions and a broker-agnostic market-data engine that produces normalized candle data. The next step is to evaluate strategies consistently across brokers without coupling strategy logic to broker SDKs, HTTP APIs, or persistence concerns.

Phase 8 is explicitly scoped to analytical signal generation only.

## Decision

- Introduce a broker-agnostic strategy abstraction:
  - input: normalized `Candle[]`
  - output: unified `Signal`
- Keep strategy logic independent from:
  - broker adapters
  - Prisma/database access
  - HTTP controllers
  - order execution
- Introduce a lightweight indicator abstraction and engine with internal deterministic implementations for EMA and RSI
- Introduce a strategy registry responsible for:
  - listing registered strategies
  - lookup by strategy id
  - dispatching evaluation by id
- Add an application-level evaluation service that coordinates:
  - market data retrieval through the existing market-data engine
  - strategy selection through the registry
  - strategy evaluation over closed candles only
- Use a unified signal model with `BUY`, `SELL`, and `HOLD` as analytical outcomes
- Defer signal persistence to a later phase until execution/audit/backtesting requirements are introduced
- Keep Phase 8 execution-free:
  - no order placement
  - no paper trading
  - no live trading
  - no strategy scheduling

## Consequences

- Strategy logic remains portable and reusable across broker integrations
- Signals are explicit analytical outputs and cannot accidentally execute trades
- Closed-candle filtering reduces false positives caused by forming candles
- EMA/RSI can be tested deterministically without live broker dependencies
- The current API can expose strategy evaluation immediately while preserving clean architecture boundaries
- Future phases can add execution, risk, persistence, and backtesting on top of stable strategy and signal contracts
