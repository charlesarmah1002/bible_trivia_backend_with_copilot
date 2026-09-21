import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { OpenAPIV3 } from 'openapi-types';
import Fastify, { type FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { AppConfig } from './config/env.js';
import { loadConfig } from './config/env.js';
import { prisma as defaultPrisma } from './lib/prisma.js';
import { registerAuthRoutes } from './modules/auth/routes.js';
import { AuthService } from './modules/auth/service.js';
import { registerProfileRoutes } from './modules/profiles/routes.js';
import { ProfileService } from './modules/profiles/service.js';
import { registerQuestionRoutes } from './modules/questions/routes.js';
import { QuestionService } from './modules/questions/service.js';
import { registerGameRoutes } from './modules/games/routes.js';
import { GameService } from './modules/games/service.js';
import { registerLeaderboardRoutes } from './modules/leaderboard/routes.js';
import { LeaderboardService } from './modules/leaderboard/service.js';
import { registerSuggestionRoutes } from './modules/suggestions/routes.js';
import { SuggestionService } from './modules/suggestions/service.js';
import { registerAdminRoutes } from './modules/admin/routes.js';
import { AdminService } from './modules/admin/service.js';
import { openapiDocument } from './docs/openapi.js';
import './modules/auth/types.js';

type BuildAppOptions = {
  config?: AppConfig;
  logger?: boolean;
  prisma?: PrismaClient;
};

export async function buildApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const prisma = options.prisma ?? defaultPrisma;
  const app = Fastify({
    logger: options.logger ?? config.nodeEnv !== 'test',
    requestIdHeader: 'x-request-id',
    genReqId: (request) =>
      request.headers['x-request-id']?.toString() ?? crypto.randomUUID(),
  });
  app.decorateRequest('currentUser', undefined);
  app.decorateRequest('userId', undefined);
  app.decorateRequest('role', undefined);

  await app.register(swagger, {
    mode: 'static',
    specification: {
      document: openapiDocument as unknown as OpenAPIV3.Document,
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(helmet);
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: (_request, context) => {
      const error = new Error(
        `Rate limit exceeded. Retry in ${context.after}.`,
      ) as Error & { statusCode: number };
      error.statusCode = context.statusCode;
      return error;
    },
  });
  await app.register(cors, {
    origin:
      config.corsOrigins.length === 1
        ? config.corsOrigins[0]
        : config.corsOrigins,
  });

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('x-request-id', request.id);
    return payload;
  });

  app.setErrorHandler((error, request, reply) => {
    const statusCode =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number' &&
      error.statusCode >= 400
        ? error.statusCode
        : 500;
    const message = error instanceof Error ? error.message : 'Request failed';

    if (statusCode >= 500) {
      request.log.error(error);
    }

    reply.status(statusCode).send({
      error: {
        code:
          statusCode >= 500
            ? 'INTERNAL_SERVER_ERROR'
            : statusCode === 429
              ? 'RATE_LIMITED'
              : 'REQUEST_ERROR',
        message: statusCode >= 500 ? 'Internal server error' : message,
        requestId: request.id,
      },
    });
  });

  app.get('/health', async () => ({ status: 'ok' }));
  const authService = new AuthService(prisma, config);
  await registerAuthRoutes(app, authService);
  await registerProfileRoutes(app, new ProfileService(prisma), authService);
  await registerQuestionRoutes(app, new QuestionService(prisma));
  await registerGameRoutes(app, new GameService(prisma), authService);
  await registerLeaderboardRoutes(
    app,
    new LeaderboardService(prisma),
    authService,
  );
  await registerSuggestionRoutes(
    app,
    new SuggestionService(prisma),
    authService,
  );
  await registerAdminRoutes(app, new AdminService(prisma), authService);

  return app;
}
