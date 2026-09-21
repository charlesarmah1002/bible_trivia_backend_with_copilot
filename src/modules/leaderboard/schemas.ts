import { z } from 'zod';

export const leaderboardQuerySchema = z
  .object({
    scope: z.enum(['global', 'weekly']).default('global'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;
