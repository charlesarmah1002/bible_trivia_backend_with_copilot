import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { testConfig } from './helpers.js';

const suffix = Date.now().toString();
const users = [
  { username: `gamma_${suffix}`, score: 300, correct: 9, incorrect: 1, daysAgo: 0 },
  { username: `alpha_${suffix}`, score: 100, correct: 5, incorrect: 5, daysAgo: 0 },
  { username: `beta_${suffix}`, score: 100, correct: 5, incorrect: 5, daysAgo: 0 },
  { username: `old_${suffix}`, score: 1000, correct: 20, incorrect: 0, daysAgo: 14 },
];
let app: Awaited<ReturnType<typeof buildApp>>;
const userIds: string[] = [];
const gameIds: string[] = [];
let betaToken: string;

beforeAll(async () => {
  app = await buildApp({ config: testConfig(), logger: false });

  for (const userData of users) {
    const registration = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { username: userData.username, email: `${userData.username}@example.com`, password: 'strong-password' },
    });
    const user = registration.json().user;
    userIds.push(user.id);

    const completedAt = new Date();
    completedAt.setUTCDate(completedAt.getUTCDate() - userData.daysAgo);
    const game = await prisma.game.create({
      data: {
        userId: user.id,
        questionCount: 20,
        status: 'COMPLETED',
        completedAt,
        result: {
          create: {
            totalScore: userData.score,
            correctAnswers: userData.correct,
            incorrectAnswers: userData.incorrect,
            accuracy: (userData.correct / (userData.correct + userData.incorrect)) * 100,
            longestStreak: userData.correct,
            completedAt,
          },
        },
      },
    });
    gameIds.push(game.id);
  }

  const betaLogin = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { identifier: users[2].username, password: 'strong-password' },
  });
  betaToken = betaLogin.json().accessToken;
});

afterAll(async () => {
  await app.close();
  await prisma.game.deleteMany({ where: { id: { in: gameIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe('leaderboards', () => {
  it('ranks completed games by score with deterministic tie-breaking', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/leaderboard?scope=global&limit=100' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data.slice(0, 4)).toEqual([
      expect.objectContaining({ rank: 1, username: users[3].username, score: 1000, accuracy: 100 }),
      expect.objectContaining({ rank: 2, username: users[0].username, score: 300, gamesPlayed: 1, accuracy: 90 }),
      expect.objectContaining({ rank: 3, username: users[1].username, score: 100, accuracy: 50 }),
      expect.objectContaining({ rank: 4, username: users[2].username, score: 100, accuracy: 50 }),
    ]);
  });

  it('supports pagination while preserving absolute ranks', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/leaderboard?scope=global&page=2&limit=2' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.data.map((entry: { rank: number }) => entry.rank)).toEqual([3, 4]);
    expect(body.pagination).toMatchObject({ page: 2, limit: 2, total: 4, totalPages: 2 });
  });

  it('includes only completed games in weekly rankings', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/leaderboard?scope=weekly&limit=100' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data.map((entry: { username: string }) => entry.username)).toEqual([
      users[0].username,
      users[1].username,
      users[2].username,
    ]);
    expect(body.data.some((entry: { username: string }) => entry.username === users[3].username)).toBe(false);
  });

  it('returns the authenticated user rank for global and weekly scopes', async () => {
    const global = await app.inject({
      method: 'GET',
      url: '/api/v1/leaderboard/me?scope=global',
      headers: { authorization: `Bearer ${betaToken}` },
    });
    const weekly = await app.inject({
      method: 'GET',
      url: '/api/v1/leaderboard/me?scope=weekly',
      headers: { authorization: `Bearer ${betaToken}` },
    });

    expect(global.statusCode).toBe(200);
    expect(global.json()).toMatchObject({ scope: 'global', rank: 4, entry: { username: users[2].username, rank: 4 } });
    expect(weekly.json()).toMatchObject({ scope: 'weekly', rank: 3, entry: { username: users[2].username, rank: 3 } });
  });

  it('rejects invalid leaderboard filters and protects the current rank route', async () => {
    const invalidScope = await app.inject({ method: 'GET', url: '/api/v1/leaderboard?scope=monthly' });
    const invalidPage = await app.inject({ method: 'GET', url: '/api/v1/leaderboard?page=0' });
    const unauthenticated = await app.inject({ method: 'GET', url: '/api/v1/leaderboard/me' });

    expect(invalidScope.statusCode).toBe(400);
    expect(invalidPage.statusCode).toBe(400);
    expect(unauthenticated.statusCode).toBe(401);
  });

  it('keeps public profile data private while exposing its completed-game stats', async () => {
    const response = await app.inject({ method: 'GET', url: `/api/v1/users/${users[0].username}` });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({ username: users[0].username, gamesPlayed: 1, totalScore: 300, accuracy: 90 });
    expect(body.email).toBeUndefined();
    expect(body.passwordHash).toBeUndefined();
    expect(body.refreshTokens).toBeUndefined();
  });
});
