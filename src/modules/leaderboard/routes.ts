import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BadRequestError } from '../../utils/errors.js';
import { createAuthMiddleware } from '../auth/middleware.js';
import { AuthService } from '../auth/service.js';
import { leaderboardQuerySchema } from './schemas.js';
import { LeaderboardService } from './service.js';

export async function registerLeaderboardRoutes(
  app: FastifyInstance,
  leaderboardService: LeaderboardService,
  authService: AuthService,
): Promise<void> {
  const { requireAuth } = createAuthMiddleware(authService);

  app.get('/api/v1/leaderboard', async (request) => {
    return leaderboardService.list(parseValue(leaderboardQuerySchema, request.query));
  });

  app.get('/api/v1/leaderboard/me', { preHandler: requireAuth }, async (request) => {
    const query = parseValue(leaderboardQuerySchema, request.query);
    return leaderboardService.getMyRank(request.userId as string, query.scope);
  });
}

function parseValue<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestError(result.error.issues[0]?.message ?? 'Invalid request');
  }
  return result.data;
}
