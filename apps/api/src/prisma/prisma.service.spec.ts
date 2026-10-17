import { describe, expect, it, vi } from 'vitest';

vi.mock('@prisma/client', () => {
  class MockPrismaClient {
    async $connect() {}

    async $disconnect() {}

    async $queryRaw() {
      return [];
    }
  }

  return {
    default: {
      PrismaClient: MockPrismaClient,
    },
  };
});

import { PrismaService } from './prisma.service.js';

function createConfig(databaseUrl: string) {
  return {
    getString: vi.fn((key: string, defaultValue?: string) => {
      if (key === 'DATABASE_URL') {
        return databaseUrl;
      }

      return defaultValue ?? '';
    }),
  } as never;
}

describe('PrismaService', () => {
  it('starts without connecting when DATABASE_URL is absent', async () => {
    const service = new PrismaService(createConfig(''));
    const connectSpy = vi.fn();
    (service as any).$connect = connectSpy;

    await service.onModuleInit();

    expect(connectSpy).not.toHaveBeenCalled();
    expect(service.getDatabaseStatus()).toBe('disabled');
  });

  it('marks the database disconnected when connect fails', async () => {
    const service = new PrismaService(createConfig('postgresql://user:pass@127.0.0.1:65432/test'));
    const connectSpy = vi.fn().mockRejectedValue(new Error('unreachable'));
    (service as any).$connect = connectSpy;

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(service.getDatabaseStatus()).toBe('disconnected');
  });
});
