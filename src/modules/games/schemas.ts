import { z } from 'zod';

export const gameIdParamsSchema = z.object({
  gameId: z.string().trim().min(1),
});

export const createGameSchema = z
  .object({
    gameType: z.literal('SOLO'),
    questionCount: z.literal(20),
  })
  .strict();

export const submitAnswerSchema = z
  .object({
    questionId: z.string().trim().min(1),
    selectedOptionId: z.string().trim().min(1),
    responseTimeMs: z.number().int().min(0).max(600000),
  })
  .strict();

export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
