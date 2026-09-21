import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { jwtVerify } from 'jose';
import { buildApp } from '../src/app.js';
import { testConfig } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';

const suffix = Date.now().toString();
const config = testConfig({ jwtSecret: `access-${suffix}`, jwtRefreshSecret: `refresh-${suffix}` });
const createdUsernames: string[] = [];
let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  app = await buildApp({ config, logger: false });
});

afterAll(async () => {
  await app.close();
  await prisma.user.deleteMany({ where: { normalizedUsername: { in: createdUsernames } } });
  await prisma.$disconnect();
});

async function register(username: string, email = `${username}@example.com`, password = 'strong-password') {
  createdUsernames.push(username.trim().toLowerCase());
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { username, email, password },
  });
}

describe('authentication', () => {
  it('registers a user, normalizes identifiers, hashes the password, and omits passwordHash', async () => {
    const response = await register(` Wesley_${suffix} `, ` USER_${suffix}@Example.COM `);
    const body = response.json();

    expect(response.statusCode).toBe(201);
    expect(body.user).toMatchObject({ username: `Wesley_${suffix}`, email: `USER_${suffix}@Example.COM` });
    expect(body.user.passwordHash).toBeUndefined();
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.refreshToken).toEqual(expect.any(String));

    const user = await prisma.user.findUnique({ where: { normalizedUsername: `wesley_${suffix}` } });
    expect(user?.normalizedEmail).toBe(`user_${suffix}@example.com`);
    expect(user?.passwordHash).toMatch(/^\$argon2/);
  });

  it('rejects duplicate usernames and emails after normalization', async () => {
    const username = `duplicate_${suffix}`;
    await register(username, `duplicate_${suffix}@example.com`);

    const duplicateUsername = await register(username.toUpperCase(), `other_${suffix}@example.com`);
    expect(duplicateUsername.statusCode).toBe(409);

    const duplicateEmail = await register(`other_${suffix}`, `DUPLICATE_${suffix}@EXAMPLE.COM`);
    expect(duplicateEmail.statusCode).toBe(409);
  });

  it('rejects weak passwords and invalid email addresses', async () => {
    const weakPassword = await register(`weak_${suffix}`, `weak_${suffix}@example.com`, 'short');
    expect(weakPassword.statusCode).toBe(400);

    const invalidEmail = await register(`invalid_${suffix}`, 'not-an-email');
    expect(invalidEmail.statusCode).toBe(400);
  });

  it('logs in with username or email and rejects invalid credentials', async () => {
    const username = `login_${suffix}`;
    await register(username, `login_${suffix}@example.com`);

    const byUsername = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: username.toUpperCase(), password: 'strong-password' },
    });
    expect(byUsername.statusCode).toBe(200);

    const byEmail = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: `LOGIN_${suffix}@EXAMPLE.COM`, password: 'strong-password' },
    });
    expect(byEmail.statusCode).toBe(200);

    const incorrectPassword = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: username, password: 'wrong-password' },
    });
    expect(incorrectPassword.statusCode).toBe(401);

    const nonexistent = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: `missing_${suffix}`, password: 'strong-password' },
    });
    expect(nonexistent.statusCode).toBe(401);
  });

  it('rejects suspended and disabled accounts', async () => {
    const suspended = `suspended_${suffix}`;
    const disabled = `disabled_${suffix}`;
    await register(suspended);
    await register(disabled);
    await prisma.user.update({ where: { normalizedUsername: suspended }, data: { status: 'SUSPENDED' } });
    await prisma.user.update({ where: { normalizedUsername: disabled }, data: { status: 'DISABLED' } });

    for (const identifier of [suspended, disabled]) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { identifier, password: 'strong-password' },
      });
      expect(response.statusCode).toBe(401);
    }
  });

  it('issues short-lived access tokens and rotates refresh tokens', async () => {
    const username = `tokens_${suffix}`;
    const registration = await register(username);
    const initial = registration.json();
    const secret = new TextEncoder().encode(config.jwtSecret);
    const verified = await jwtVerify(initial.accessToken, secret, { algorithms: ['HS256'] });

    expect(verified.payload.sub).toBeTruthy();
    expect(verified.payload.type).toBe('access');
    expect((verified.payload.exp ?? 0) - (verified.payload.iat ?? 0)).toBeLessThanOrEqual(900);

    const refreshed = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: initial.refreshToken },
    });
    expect(refreshed.statusCode).toBe(200);
    const replacement = refreshed.json();
    expect(replacement.refreshToken).not.toBe(initial.refreshToken);

    const oldTokenReuse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: initial.refreshToken },
    });
    expect(oldTokenReuse.statusCode).toBe(401);
  });

  it('logs out by revoking the refresh token', async () => {
    const registration = await register(`logout_${suffix}`);
    const token = registration.json().refreshToken;

    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      payload: { refreshToken: token },
    });
    expect(logout.statusCode).toBe(204);

    const refresh = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: token },
    });
    expect(refresh.statusCode).toBe(401);
  });

  it('protects routes and enforces roles server-side', async () => {
    const unauthenticated = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(unauthenticated.statusCode).toBe(401);

    const username = `roles_${suffix}`;
    await register(username);
    const userLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: username, password: 'strong-password' },
    });
    const userToken = userLogin.json().accessToken;

    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.passwordHash).toBeUndefined();

    const forbidden = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/admin-check',
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(forbidden.statusCode).toBe(403);

    await prisma.user.update({ where: { normalizedUsername: username }, data: { role: 'ADMIN' } });
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: username, password: 'strong-password' },
    });
    const adminAccess = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/admin-check',
      headers: { authorization: `Bearer ${adminLogin.json().accessToken}` },
    });
    expect(adminAccess.statusCode).toBe(200);
  });
});
