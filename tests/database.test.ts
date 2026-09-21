import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('database connection', () => {
  it('connects to SQLite through Prisma', async () => {
    await expect(prisma.$connect()).resolves.toBeUndefined();
  });
});
