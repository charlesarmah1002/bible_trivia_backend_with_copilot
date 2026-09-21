import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BadRequestError } from '../../utils/errors.js';
import { questionIdParamsSchema, questionQuerySchema } from './schemas.js';
import { QuestionService } from './service.js';

export async function registerQuestionRoutes(app: FastifyInstance, questionService: QuestionService): Promise<void> {
  app.get('/api/v1/questions', async (request) => {
    const query = parseValue(questionQuerySchema, request.query);
    return questionService.list(query);
  });

  app.get('/api/v1/questions/:id', async (request) => {
    const params = parseValue(questionIdParamsSchema, request.params);
    return questionService.getById(params.id);
  });
}

function parseValue<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestError(result.error.issues[0]?.message ?? 'Invalid request');
  }
  return result.data;
}
