import { z } from 'zod';

export const questionIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const questionQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    category: z.string().trim().min(1).optional(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
    type: z.literal('MULTIPLE_CHOICE').optional(),
  })
  .strict();

export type QuestionQuery = z.infer<typeof questionQuerySchema>;
