import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BadRequestError } from '../../utils/errors.js';
import { createAuthMiddleware } from '../auth/middleware.js';
import { AuthService } from '../auth/service.js';
import { usernameParamsSchema, updateProfileSchema } from './schemas.js';
import { ProfileService } from './service.js';

export async function registerProfileRoutes(
  app: FastifyInstance,
  profileService: ProfileService,
  authService: AuthService,
): Promise<void> {
  const { requireAuth } = createAuthMiddleware(authService);

  app.get('/api/v1/users/me', { preHandler: requireAuth }, async (request) => {
    return profileService.getCurrentProfile(request.userId as string);
  });

  app.patch('/api/v1/users/me', { preHandler: requireAuth }, async (request) => {
    const input = parseBody(updateProfileSchema, request.body);
    return profileService.updateCurrentProfile(request.userId as string, input);
  });

  app.get('/api/v1/users/:username', async (request) => {
    const params = parseBody(usernameParamsSchema, request.params);
    return profileService.getPublicProfile(params.username);
  });
}

function parseBody<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestError(result.error.issues[0]?.message ?? 'Invalid request');
  }
  return result.data;
}
