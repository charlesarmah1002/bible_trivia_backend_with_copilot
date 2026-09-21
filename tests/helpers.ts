import type { AppConfig } from '../src/config/env.js';

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    databaseUrl: 'file:./test.db',
    jwtSecret: 'test-secret',
    jwtRefreshSecret: 'test-refresh-secret',
    port: 3000,
    nodeEnv: 'test',
    corsOrigins: ['http://localhost:3000'],
    ...overrides,
  };
}
