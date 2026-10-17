import { describe, expect, it, vi } from 'vitest';
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
    const connectSpy = vi.spyOn(PrismaService.prototype as any, '$connect').mockResolvedValue(undefined as never);
    const service = new PrismaService(createConfig(''));

    await service.onModuleInit();

    expect(connectSpy).not.toHaveBeenCalled();
    expect(service.getDatabaseStatus()).toBe('disabled');

    connectSpy.mockRestore();
  });

  it('marks the database disconnected when connect fails', async () => {
    const connectSpy = vi.spyOn(PrismaService.prototype as any, '$connect').mockRejectedValue(new Error('unreachable'));
    const service = new PrismaService(createConfig('postgresql://user:pass@127.0.0.1:65432/test'));

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(service.getDatabaseStatus()).toBe('disconnected');

    connectSpy.mockRestore();
  });
});
