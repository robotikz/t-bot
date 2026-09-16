import { describe, expect, it, vi } from 'vitest';
import { Trading212BrokerAdapter } from '../adapters/trading212-broker.adapter.js';
import { BrokerRegistryService } from './broker-registry.service.js';

describe('BrokerRegistryService', () => {
  it('does not register disabled brokers', () => {
    const configService = {
      getBoolean: vi.fn(() => false),
      getString: vi.fn(() => ''),
      getNumber: vi.fn(() => 10_000),
    } as never;
    const register = vi.fn();
    const brokerManager = {
      register,
    } as never;

    const service = new BrokerRegistryService(configService, brokerManager);
    service.onModuleInit();

    expect(register).not.toHaveBeenCalled();
  });

  it('registers Trading212 when enabled without requiring credentials at startup', () => {
    const configService = {
      getBoolean: vi.fn((key: string) => key === 'TRADING212_ENABLED'),
      getString: vi.fn((key: string, defaultValue?: string) => {
        if (key === 'TRADING212_ENVIRONMENT') {
          return 'demo';
        }

        return defaultValue ?? '';
      }),
      getNumber: vi.fn(() => 10_000),
    } as never;

    const register = vi.fn();
    const brokerManager = {
      register,
    } as never;

    const service = new BrokerRegistryService(configService, brokerManager);
    service.onModuleInit();

    expect(register).toHaveBeenCalledTimes(1);
    expect(register.mock.calls[0][0]).toBeInstanceOf(Trading212BrokerAdapter);
  });
});