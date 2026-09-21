import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BadRequestError } from '../../utils/errors.js';
import { createAuthMiddleware } from '../auth/middleware.js';
import { AuthService } from '../auth/service.js';
import { createSuggestionSchema } from './schemas.js';
import { SuggestionService } from './service.js';

export async function registerSuggestionRoutes(
  app: FastifyInstance,
  suggestionService: SuggestionService,
  authService: AuthService,
): Promise<void> {
  const { requireAuth } = createAuthMiddleware(authService);

  app.post('/api/v1/suggestions', { preHandler: requireAuth }, async (request, reply) => {
    const input = parseBody(createSuggestionSchema, request.body);
    const suggestion = await suggestionService.create(request.userId as string, input);
    return reply.status(201).send(suggestion);
  });

  app.get('/api/v1/suggestions/me', { preHandler: requireAuth }, async (request) => {
    return suggestionService.listMine(request.userId as string);
  });
}

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new BadRequestError(result.error.issues[0]?.message ?? 'Invalid request body');
  }
  return result.data;
}
