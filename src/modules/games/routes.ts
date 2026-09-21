import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BadRequestError } from '../../utils/errors.js';
import { createAuthMiddleware } from '../auth/middleware.js';
import { AuthService } from '../auth/service.js';
import { createGameSchema, gameIdParamsSchema, submitAnswerSchema } from './schemas.js';
import { GameService } from './service.js';

export async function registerGameRoutes(
  app: FastifyInstance,
  gameService: GameService,
  authService: AuthService,
): Promise<void> {
  const { requireAuth } = createAuthMiddleware(authService);

  app.post('/api/v1/games', { preHandler: requireAuth }, async (request, reply) => {
    const input = parseValue(createGameSchema, request.body);
    const game = await gameService.createSoloGame(request.userId as string);
    return reply.status(201).send(game);
  });

  app.get('/api/v1/games/:gameId', { preHandler: requireAuth }, async (request) => {
    const params = parseValue(gameIdParamsSchema, request.params);
    return gameService.getGame(request.userId as string, params.gameId);
  });

  app.post('/api/v1/games/:gameId/answers', { preHandler: requireAuth }, async (request) => {
    const params = parseValue(gameIdParamsSchema, request.params);
    const input = parseValue(submitAnswerSchema, request.body);
    return gameService.submitAnswer(request.userId as string, params.gameId, input);
  });

  app.post('/api/v1/games/:gameId/complete', { preHandler: requireAuth }, async (request) => {
    const params = parseValue(gameIdParamsSchema, request.params);
    return gameService.completeGame(request.userId as string, params.gameId);
  });

  app.get('/api/v1/games/:gameId/results', { preHandler: requireAuth }, async (request) => {
    const params = parseValue(gameIdParamsSchema, request.params);
    return gameService.getResults(request.userId as string, params.gameId);
  });
}

function parseValue<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestError(result.error.issues[0]?.message ?? 'Invalid request');
  }
  return result.data;
}
