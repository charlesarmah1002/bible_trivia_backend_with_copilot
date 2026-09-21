import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPIV3 } from 'openapi-types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { testConfig } from './helpers.js';

let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  app = await buildApp({ config: testConfig(), logger: false });
});

afterAll(async () => {
  await app.close();
});

describe('OpenAPI documentation', () => {
  it('serves Swagger UI and the generated JSON document', async () => {
    const ui = await app.inject({ method: 'GET', url: '/docs' });
    const json = await app.inject({ method: 'GET', url: '/docs/json' });

    expect(ui.statusCode).toBe(200);
    expect(ui.body).toContain('swagger-ui');
    expect(json.statusCode).toBe(200);
    expect(json.json().openapi).toBe('3.0.3');
  });

  it('validates the generated OpenAPI document and covers implemented route groups', async () => {
    const document = app.swagger() as unknown as OpenAPIV3.Document;
    await expect(SwaggerParser.validate(document)).resolves.toBeDefined();

    const paths = Object.keys(document.paths ?? {});
    expect(paths).toEqual(expect.arrayContaining([
      '/api/v1/auth/register',
      '/api/v1/users/me',
      '/api/v1/questions',
      '/api/v1/games/{gameId}/answers',
      '/api/v1/games/{gameId}/results',
      '/api/v1/leaderboard',
      '/api/v1/suggestions/me',
      '/api/v1/admin/dashboard',
      '/api/v1/admin/questions/{id}',
      '/api/v1/admin/suggestions/{id}',
    ]));
    expect(document.components?.securitySchemes).toHaveProperty('bearerAuth');
    expect(document.paths?.['/api/v1/admin/dashboard']?.get?.security).toEqual([{ bearerAuth: [] }]);
    expect(document.paths?.['/api/v1/questions']?.get?.responses).toHaveProperty('200');
  });
});
