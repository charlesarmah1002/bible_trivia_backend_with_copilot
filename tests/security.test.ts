import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { testConfig } from './helpers.js';

let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  app = await buildApp({ config: testConfig(), logger: false });
  app.get('/security-test-error', async () => {
    throw new Error('private internal detail');
  });
});

afterAll(async () => {
  await app.close();
});

describe('security hardening', () => {
  it('rate-limits authentication endpoints with a safe 429 response', async () => {
    let lastResponse;
    for (let attempt = 0; attempt < 21; attempt += 1) {
      lastResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { identifier: `missing-${attempt}`, password: 'wrong-password' },
      });
    }

    expect(lastResponse?.statusCode).toBe(429);
    expect(lastResponse?.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
    expect(lastResponse?.headers['retry-after']).toBeDefined();
  });

  it('requires strong JWT secrets in production configuration', () => {
    expect(() => loadConfig({
      DATABASE_URL: 'file:./dev.db',
      JWT_SECRET: 'short',
      JWT_REFRESH_SECRET: 'short',
      PORT: '3000',
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://example.com',
    })).toThrow('production JWT secrets must be at least 32 characters');
  });

  it('returns security headers and request IDs', async () => {
    const response = await app.inject({ method: 'GET', url: '/health', headers: { 'x-request-id': 'security-test-id' } });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBe('security-test-id');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('does not expose internal error details', async () => {
    const response = await app.inject({ method: 'GET', url: '/security-test-error' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' } });
    expect(response.body).not.toContain('private internal detail');
  });

  it('blocks an access token after its user is suspended', async () => {
    const isolatedApp = await buildApp({ config: testConfig(), logger: false });
    const username = `security-user-${Date.now()}`;
    const user = await prisma.user.create({
      data: {
        username,
        normalizedUsername: username,
        email: `${username}@example.com`,
        normalizedEmail: `${username}@example.com`,
        passwordHash: 'test-hash',
        profile: { create: {} },
      },
    });
    const accessToken = await new SignJWT({ type: 'access', role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode(testConfig().jwtSecret));
    await prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });

    const response = await isolatedApp.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { authorization: `Bearer ${accessToken}` } });
    expect(response.statusCode).toBe(401);
    await prisma.user.delete({ where: { id: user.id } });
    await isolatedApp.close();
  });
});
