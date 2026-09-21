import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { ForbiddenError, UnauthorizedError } from '../../utils/errors.js';
import { AuthService } from './service.js';
import type { CurrentUser } from './types.js';

export function createAuthMiddleware(authService: AuthService) {
  const requireAuth = async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedError();
    }

    const token = authorization.slice('Bearer '.length).trim();
    if (!token) throw new UnauthorizedError();

    request.currentUser = await authService.verifyAccessToken(token);
    request.userId = request.currentUser.id;
    request.role = request.currentUser.role;
  };

  const requireRole = (...roles: string[]): preHandlerHookHandler => {
    return async (request, reply) => {
      await requireAuth(request, reply);
      const user = request.currentUser as CurrentUser;
      if (!roles.includes(user.role)) {
        throw new ForbiddenError();
      }
    };
  };

  return { requireAuth, requireRole };
}
