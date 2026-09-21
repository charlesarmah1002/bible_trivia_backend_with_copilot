import { z } from 'zod';

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(32, 'Username must be at most 32 characters')
  .regex(/^[A-Za-z0-9_]+$/, 'Username may contain only letters, numbers, and underscores');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

export const registerSchema = z.object({
  username: usernameSchema,
  email: z.string().trim().email('Invalid email address'),
  password: passwordSchema,
});

export const loginSchema = z
  .object({
    identifier: z.string().trim().min(1).optional(),
    username: z.string().trim().min(1).optional(),
    email: z.string().trim().email('Invalid email address').optional(),
    password: z.string().min(1, 'Password is required'),
  })
  .refine((input) => Boolean(input.identifier ?? input.username ?? input.email), {
    message: 'Username or email is required',
    path: ['identifier'],
  });

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const logoutSchema = refreshSchema;

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
