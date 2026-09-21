import type { User } from '@prisma/client';

export type CurrentUser = Pick<User, 'id' | 'username' | 'email' | 'role' | 'status'>;

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: CurrentUser;
};

declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: CurrentUser;
    userId?: string;
    role?: string;
  }
}
