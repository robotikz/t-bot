import { describe, expect, it } from 'vitest';

import { PrismaService } from './prisma.service.js';

describe('PrismaService', () => {
  it('is permanently disabled in database-free mode', async () => {
    const service = new PrismaService();
    expect(service.getDatabaseStatus()).toBe('disabled');
    expect(service.isDatabaseAvailable()).toBe(false);
    await expect(service.ping()).resolves.toBe('disabled');
    expect(() => service.assertDatabaseAvailable()).toThrowError(/Database is disabled/);
  });
});
