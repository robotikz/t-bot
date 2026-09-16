# ADR-0004: Trading212 read-only capability scope

## Status

Accepted

## Date

2026-09-15

## Context

The official Trading212 Public API currently exposes account summary, positions, instrument metadata, active orders, and historical account events through a basic-authenticated REST API.

However, the current Phase 4 broker abstraction only has capability providers for `MARKET_DATA`, `ACCOUNT`, and `TRADING`. Trading212 does not currently provide the Bybit-style candle/time-series market-data surface that Phase 4 expects from `MARKET_DATA`, and Phase 6 is explicitly read-only.

## Decision

- Implement Trading212 as a read-only broker adapter
- Advertise only `BrokerCapability.ACCOUNT`
- Map Trading212 account summary and positions into the existing generic `Account`, `Balance`, and `Position` domain types
- Keep Trading212-specific HTTP details isolated in the infrastructure layer
- Do not fabricate a `MARKET_DATA` capability or a trading capability just to make Trading212 look symmetric with Bybit

## Consequences

- The broker layer remains capability-oriented and reflects real broker differences
- Trading212 can be enabled safely without candle support or trading credentials being required at startup
- Read-only account and position data is available immediately, while unsupported capabilities remain explicit
- If Trading212 later adds candle/time-series market data, the adapter can be extended without changing the existing architecture
