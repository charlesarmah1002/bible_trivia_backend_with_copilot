import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { testConfig } from './helpers.js';

let app: Awaited<ReturnType<typeof buildApp>> | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('application foundation', () => {
  it('starts and exposes a health endpoint', async () => {
    app = await buildApp({ config: testConfig(), logger: false });

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('uses the centralized error handler', async () => {
    app = await buildApp({ config: testConfig(), logger: false });
    app.get('/test-error', async () => {
      throw new Error('unexpected failure');
    });

    const response = await app.inject({ method: 'GET', url: '/test-error' });

    expect(response.statusCode).toBe(500);
    expect(response.json().error).toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    });
  });
});

describe('environment validation', () => {
  it('rejects missing required environment variables', () => {
    expect(() => loadConfig({ PORT: 'not-a-port' })).toThrow('Invalid environment variables');
  });
});
