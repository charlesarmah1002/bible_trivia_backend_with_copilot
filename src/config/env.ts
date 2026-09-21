import 'dotenv/config';
import { z } from 'zod';

const environmentSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
});

export type AppConfig = {
  databaseUrl: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  port: number;
  nodeEnv: 'development' | 'test' | 'production';
  corsOrigins: string[];
};

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.safeParse(environment);

  if (!parsed.success) {
    throw new Error(`Invalid environment variables: ${parsed.error.message}`);
  }

  if (
    parsed.data.NODE_ENV === 'production' &&
    (parsed.data.JWT_SECRET.length < 32 || parsed.data.JWT_REFRESH_SECRET.length < 32)
  ) {
    throw new Error('Invalid environment variables: production JWT secrets must be at least 32 characters');
  }

  return {
    databaseUrl: parsed.data.DATABASE_URL,
    jwtSecret: parsed.data.JWT_SECRET,
    jwtRefreshSecret: parsed.data.JWT_REFRESH_SECRET,
    port: parsed.data.PORT,
    nodeEnv: parsed.data.NODE_ENV,
    corsOrigins: parsed.data.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}
