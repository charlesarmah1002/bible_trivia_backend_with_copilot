import { describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('V1 database relationships', () => {
  it('exposes the required models and relations', () => {
    expect(prisma.user).toBeDefined();
    expect(prisma.userProfile).toBeDefined();
    expect(prisma.refreshToken).toBeDefined();
    expect(prisma.question).toBeDefined();
    expect(prisma.questionOption).toBeDefined();
    expect(prisma.category).toBeDefined();
    expect(prisma.scriptureReference).toBeDefined();
    expect(prisma.game).toBeDefined();
    expect(prisma.gameQuestion).toBeDefined();
    expect(prisma.gameAnswer).toBeDefined();
    expect(prisma.gameResult).toBeDefined();
    expect(prisma.suggestion).toBeDefined();
  });
});
