import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BadRequestError } from '../../utils/errors.js';
import { createAuthMiddleware } from '../auth/middleware.js';
import { AuthService } from '../auth/service.js';
import { AdminService } from './service.js';
import { adminGameStatusSchema, adminIdParamsSchema, adminQuestionCreateSchema, adminQuestionPatchSchema, adminSuggestionPatchSchema, adminUsersQuerySchema, publishQuestionSchema } from './schemas.js';

export async function registerAdminRoutes(app: FastifyInstance, adminService: AdminService, authService: AuthService): Promise<void> {
  const { requireRole } = createAuthMiddleware(authService);
  const adminOnly = requireRole('ADMIN', 'SUPER_ADMIN');

  app.get('/api/v1/admin/dashboard', { preHandler: adminOnly }, async () => adminService.dashboard());
  app.get('/api/v1/admin/users', { preHandler: adminOnly }, async (request) => adminService.listUsers(parse(adminUsersQuerySchema, request.query)));
  app.get('/api/v1/admin/users/:id', { preHandler: adminOnly }, async (request) => adminService.getUser(parse(adminIdParamsSchema, request.params).id));
  app.patch('/api/v1/admin/users/:id/status', { preHandler: adminOnly }, async (request) => {
    const params = parse(adminIdParamsSchema, request.params);
    const body = parse(z.object({ status: adminGameStatusSchema }).strict(), request.body);
    return adminService.updateUserStatus(params.id, body.status);
  });

  app.post('/api/v1/admin/questions', { preHandler: adminOnly }, async (request, reply) => reply.status(201).send(await adminService.createQuestion(parse(adminQuestionCreateSchema, request.body))));
  app.patch('/api/v1/admin/questions/:id', { preHandler: adminOnly }, async (request) => adminService.updateQuestion(parse(adminIdParamsSchema, request.params).id, parse(adminQuestionPatchSchema, request.body)));
  app.delete('/api/v1/admin/questions/:id', { preHandler: adminOnly }, async (request) => adminService.archiveQuestion(parse(adminIdParamsSchema, request.params).id));
  app.patch('/api/v1/admin/questions/:id/publish', { preHandler: adminOnly }, async (request) => {
    const params = parse(adminIdParamsSchema, request.params);
    const body = parse(publishQuestionSchema, request.body);
    return adminService.publishQuestion(params.id, body.published);
  });

  app.get('/api/v1/admin/suggestions', { preHandler: adminOnly }, async () => adminService.listSuggestions());
  app.get('/api/v1/admin/suggestions/:id', { preHandler: adminOnly }, async (request) => adminService.getSuggestion(parse(adminIdParamsSchema, request.params).id));
  app.patch('/api/v1/admin/suggestions/:id', { preHandler: adminOnly }, async (request) => adminService.updateSuggestion(parse(adminIdParamsSchema, request.params).id, request.userId as string, parse(adminSuggestionPatchSchema, request.body)));
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestError(result.error.issues[0]?.message ?? 'Invalid request');
  return result.data;
}
