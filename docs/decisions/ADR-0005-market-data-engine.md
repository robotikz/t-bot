# ADR-0005: Unified market-data engine and broker-aware candle identity

## Status

Accepted

## Date

2026-09-16

## Context

The platform needs a broker-agnostic market-data layer between broker adapters and persistence so historical candles can be fetched, validated, stored, and read back without coupling the application to Bybit-specific response formats.

The existing Candle domain model was broker-neutral, but it did not distinguish identical symbol/timeframe/openTime candles coming from different brokers.

## Decision

- Introduce a dedicated market-data application layer that separates fetch, ingest, and read operations
- Keep broker-specific candle retrieval inside the broker adapter and HTTP client layers
- Use the canonical candle identity `brokerId + symbol + timeframe + openTime`
- Add a database uniqueness constraint on `(brokerId, symbol, timeframe, openTime)` and order candle reads `oldest → newest`
- Treat candle closure as a computed concern in the market-data engine using timestamps and current time instead of relying on array position
- Keep market discovery and candle fetching broker-backed and capability-gated through `BrokerCapability.MARKET_DATA`

## Consequences

- Duplicate candle ingestion becomes idempotent at the database boundary
- The market-data engine can support future brokers without importing Bybit-specific infrastructure
- Stored candles can be safely read back and reloaded for backtesting, repair, or replay workflows
- Incomplete candles remain distinguishable from closed candles without polluting the broker adapters with persistence concerns
