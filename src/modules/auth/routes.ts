import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BadRequestError } from '../../utils/errors.js';
import { AuthService } from './service.js';
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from './schemas.js';
import { createAuthMiddleware } from './middleware.js';

export async function registerAuthRoutes(app: FastifyInstance, authService: AuthService): Promise<void> {
  const { requireAuth, requireRole } = createAuthMiddleware(authService);
  const authRateLimit = { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } };

  app.post('/api/v1/auth/register', authRateLimit, async (request, reply) => {
    const input = parseBody(registerSchema, request.body);
    const result = await authService.register(input);
    return reply.status(201).send(result);
  });

  app.post('/api/v1/auth/login', authRateLimit, async (request) => {
    const input = parseBody(loginSchema, request.body);
    return authService.login(input);
  });

  app.post('/api/v1/auth/refresh', authRateLimit, async (request) => {
    const input = parseBody(refreshSchema, request.body);
    return authService.refresh(input.refreshToken);
  });

  app.post('/api/v1/auth/logout', authRateLimit, async (request, reply) => {
    const input = parseBody(logoutSchema, request.body);
    await authService.logout(input.refreshToken);
    return reply.status(204).send();
  });

  app.get('/api/v1/auth/me', { preHandler: requireAuth }, async (request) => ({ user: request.currentUser }));

  app.get('/api/v1/auth/admin-check', { preHandler: requireRole('ADMIN', 'SUPER_ADMIN') }, async () => ({ authorized: true }));
}

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new BadRequestError(result.error.issues[0]?.message ?? 'Invalid request body');
  }
  return result.data;
}
