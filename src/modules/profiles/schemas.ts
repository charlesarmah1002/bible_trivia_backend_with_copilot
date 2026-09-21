import { z } from 'zod';

export const usernameParamsSchema = z.object({
  username: z.string().trim().min(1).max(32),
});

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().max(100).nullable().optional(),
    avatarUrl: z.string().trim().url().max(500).nullable().optional(),
    bio: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .refine((profile) => Object.keys(profile).length > 0, {
    message: 'At least one profile field is required',
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
