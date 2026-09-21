import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { testConfig } from './helpers.js';

const suffix = Date.now().toString();
const username = `Public_${suffix}`;
let userId: string;
let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  app = await buildApp({ config: testConfig(), logger: false });
  const registration = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { username, email: `profile_${suffix}@example.com`, password: 'strong-password' },
  });
  userId = registration.json().user.id;
});

afterAll(async () => {
  await app.close();
  await prisma.game.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

async function accessToken(): Promise<string> {
  const login = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { identifier: username, password: 'strong-password' },
  });
  return login.json().accessToken;
}

describe('user profiles', () => {
  it('gets and updates the current user safe profile fields', async () => {
    const token = await accessToken();
    const before = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(before.statusCode).toBe(200);
    expect(before.json()).toMatchObject({ username, email: `profile_${suffix}@example.com` });
    expect(before.json().passwordHash).toBeUndefined();
    expect(before.json().refreshTokens).toBeUndefined();

    const updated = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        displayName: 'Wesley',
        avatarUrl: 'https://example.com/avatar.png',
        bio: 'Bible trivia player',
      },
    });

    expect(updated.statusCode).toBe(200);
    expect(updated.json().profile).toMatchObject({
      displayName: 'Wesley',
      avatarUrl: 'https://example.com/avatar.png',
      bio: 'Bible trivia player',
    });
  });

  it('rejects account and authorization fields from the profile endpoint', async () => {
    const token = await accessToken();
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'ADMIN', status: 'DISABLED', email: 'attacker@example.com', passwordHash: 'bad' },
    });

    expect(response.statusCode).toBe(400);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user).toMatchObject({ role: 'USER', status: 'ACTIVE', normalizedEmail: `profile_${suffix}@example.com` });
  });

  it('returns safe public profile data and aggregate game statistics', async () => {
    await prisma.game.create({
      data: {
        userId,
        questionCount: 20,
        status: 'COMPLETED',
        completedAt: new Date(),
        result: {
          create: {
            totalScore: 100,
            correctAnswers: 16,
            incorrectAnswers: 4,
            accuracy: 80,
            longestStreak: 4,
            completedAt: new Date(),
          },
        },
      },
    });
    await prisma.game.create({
      data: {
        userId,
        questionCount: 20,
        status: 'COMPLETED',
        completedAt: new Date(),
        result: {
          create: {
            totalScore: 200,
            correctAnswers: 17,
            incorrectAnswers: 3,
            accuracy: 85,
            longestStreak: 5,
            completedAt: new Date(),
          },
        },
      },
    });

    const response = await app.inject({ method: 'GET', url: `/api/v1/users/${username.toLowerCase()}` });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      username,
      gamesPlayed: 2,
      totalScore: 300,
      accuracy: 82.5,
    });
    expect(body.profile).toMatchObject({ displayName: 'Wesley' });
    expect(body.email).toBeUndefined();
    expect(body.passwordHash).toBeUndefined();
    expect(body.refreshTokens).toBeUndefined();
    expect(body.role).toBeUndefined();
    expect(body.status).toBeUndefined();
  });

  it('returns not found for an unknown public username', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/users/does-not-exist' });
    expect(response.statusCode).toBe(404);
  });
});
