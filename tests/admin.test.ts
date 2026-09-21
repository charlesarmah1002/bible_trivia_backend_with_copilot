import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { testConfig } from './helpers.js';

const suffix = Date.now().toString();
let app: Awaited<ReturnType<typeof buildApp>>;
let adminId: string;
let superAdminId: string;
let userId: string;
let adminToken: string;
let superAdminToken: string;
let userToken: string;
let adminQuestionId: string;
let suggestionId: string;

beforeAll(async () => {
  app = await buildApp({ config: testConfig(), logger: false });
  const admin = await register(`admin_${suffix}`);
  const superAdmin = await register(`superadmin_${suffix}`);
  const user = await register(`regular_${suffix}`);
  adminId = admin.user.id;
  superAdminId = superAdmin.user.id;
  userId = user.user.id;
  adminToken = admin.accessToken;
  superAdminToken = superAdmin.accessToken;
  userToken = user.accessToken;
  await prisma.user.update({ where: { id: adminId }, data: { role: 'ADMIN' } });
  await prisma.user.update({ where: { id: superAdminId }, data: { role: 'SUPER_ADMIN' } });

  const suggestion = await app.inject({
    method: 'POST',
    url: '/api/v1/suggestions',
    headers: { authorization: `Bearer ${userToken}` },
    payload: { type: 'QUESTION', title: 'Admin review test', description: 'Please review this suggestion.' },
  });
  suggestionId = suggestion.json().id;
});

afterAll(async () => {
  await app.close();
  await prisma.suggestion.deleteMany({ where: { id: suggestionId } });
  if (adminQuestionId) await prisma.question.delete({ where: { id: adminQuestionId } });
  await prisma.user.deleteMany({ where: { id: { in: [adminId, superAdminId, userId] } } });
  await prisma.$disconnect();
});

async function register(username: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { username, email: `${username}@example.com`, password: 'strong-password' },
  });
  return response.json();
}

const questionPayload = {
  text: 'Which leader succeeded Moses?',
  type: 'MULTIPLE_CHOICE',
  difficulty: 'MEDIUM',
  explanation: 'Joshua led Israel after Moses.',
  options: [
    { text: 'Joshua', order: 1, isCorrect: true },
    { text: 'David', order: 2, isCorrect: false },
    { text: 'Samuel', order: 3, isCorrect: false },
    { text: 'Elijah', order: 4, isCorrect: false },
  ],
  scripture: { book: 'Joshua', chapter: 1, verse: 1, verseEnd: 9 },
};

describe('admin API authorization', () => {
  it('denies regular users and allows ADMIN and SUPER_ADMIN', async () => {
    const user = await app.inject({ method: 'GET', url: '/api/v1/admin/dashboard', headers: { authorization: `Bearer ${userToken}` } });
    const admin = await app.inject({ method: 'GET', url: '/api/v1/admin/dashboard', headers: { authorization: `Bearer ${adminToken}` } });
    const superAdmin = await app.inject({ method: 'GET', url: '/api/v1/admin/dashboard', headers: { authorization: `Bearer ${superAdminToken}` } });

    expect(user.statusCode).toBe(403);
    expect(admin.statusCode).toBe(200);
    expect(superAdmin.statusCode).toBe(200);
  });

  it('returns dashboard metrics from the backend', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/dashboard', headers: { authorization: `Bearer ${adminToken}` } });
    expect(response.json()).toEqual(expect.objectContaining({
      totalUsers: expect.any(Number),
      activeUsers: expect.any(Number),
      suspendedUsers: expect.any(Number),
      disabledUsers: expect.any(Number),
      totalGames: expect.any(Number),
      completedGames: expect.any(Number),
      totalQuestions: expect.any(Number),
      publishedQuestions: expect.any(Number),
      pendingSuggestions: expect.any(Number),
      totalAnswers: expect.any(Number),
      correctAnswers: expect.any(Number),
    }));
  });
});

describe('admin user management', () => {
  it('searches, filters, retrieves, and changes user status without exposing password hashes', async () => {
    const list = await app.inject({ method: 'GET', url: `/api/v1/admin/users?search=regular_${suffix}&status=ACTIVE`, headers: { authorization: `Bearer ${adminToken}` } });
    expect(list.statusCode).toBe(200);
    expect(list.json().data).toHaveLength(1);
    expect(list.json().data[0].passwordHash).toBeUndefined();

    const detail = await app.inject({ method: 'GET', url: `/api/v1/admin/users/${userId}`, headers: { authorization: `Bearer ${adminToken}` } });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({ id: userId, username: `regular_${suffix}`, role: 'USER', status: 'ACTIVE' });
    expect(detail.json().passwordHash).toBeUndefined();

    const update = await app.inject({ method: 'PATCH', url: `/api/v1/admin/users/${userId}/status`, headers: { authorization: `Bearer ${adminToken}` }, payload: { status: 'SUSPENDED' } });
    expect(update.statusCode).toBe(200);
    expect(update.json().status).toBe('SUSPENDED');

    const invalid = await app.inject({ method: 'PATCH', url: `/api/v1/admin/users/${userId}/status`, headers: { authorization: `Bearer ${adminToken}` }, payload: { status: 'NOT_A_STATUS' } });
    expect(invalid.statusCode).toBe(400);
  });
});

describe('admin question management', () => {
  it('validates question options, category, and Scripture fields', async () => {
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: 'PEOPLE' } });
    const invalidOptions = await app.inject({ method: 'POST', url: '/api/v1/admin/questions', headers: { authorization: `Bearer ${adminToken}` }, payload: { ...questionPayload, categoryId: category.id, options: questionPayload.options.slice(0, 3) } });
    const invalidCategory = await app.inject({ method: 'POST', url: '/api/v1/admin/questions', headers: { authorization: `Bearer ${adminToken}` }, payload: { ...questionPayload, categoryId: 'missing-category' } });
    const invalidScripture = await app.inject({ method: 'POST', url: '/api/v1/admin/questions', headers: { authorization: `Bearer ${adminToken}` }, payload: { ...questionPayload, categoryId: category.id, scripture: { book: '', chapter: 0, verse: 0 } } });

    expect(invalidOptions.statusCode).toBe(400);
    expect(invalidCategory.statusCode).toBe(404);
    expect(invalidScripture.statusCode).toBe(400);
  });

  it('creates, publishes, updates, and archives questions safely', async () => {
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: 'PEOPLE' } });
    const created = await app.inject({ method: 'POST', url: '/api/v1/admin/questions', headers: { authorization: `Bearer ${adminToken}` }, payload: { ...questionPayload, categoryId: category.id } });
    adminQuestionId = created.json().id;
    expect(created.statusCode).toBe(201);
    expect(created.json().options[0].isCorrect).toBe(true);

    const publish = await app.inject({ method: 'PATCH', url: `/api/v1/admin/questions/${adminQuestionId}/publish`, headers: { authorization: `Bearer ${adminToken}` }, payload: { published: true } });
    expect(publish.statusCode).toBe(200);
    const publicQuestion = await app.inject({ method: 'GET', url: `/api/v1/questions/${adminQuestionId}` });
    expect(publicQuestion.statusCode).toBe(200);

    const update = await app.inject({ method: 'PATCH', url: `/api/v1/admin/questions/${adminQuestionId}`, headers: { authorization: `Bearer ${adminToken}` }, payload: { difficulty: 'HARD', explanation: 'Updated explanation.' } });
    expect(update.statusCode).toBe(200);
    expect(update.json()).toMatchObject({ difficulty: 'HARD', explanation: 'Updated explanation.' });

    const archive = await app.inject({ method: 'DELETE', url: `/api/v1/admin/questions/${adminQuestionId}`, headers: { authorization: `Bearer ${adminToken}` } });
    expect(archive.statusCode).toBe(200);
    expect(archive.json()).toMatchObject({ archived: true, published: false });
    const hidden = await app.inject({ method: 'GET', url: `/api/v1/questions/${adminQuestionId}` });
    expect(hidden.statusCode).toBe(404);
  });
});

describe('admin suggestion management', () => {
  it('lists, retrieves, reviews, and records admin metadata', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/v1/admin/suggestions', headers: { authorization: `Bearer ${adminToken}` } });
    expect(list.statusCode).toBe(200);
    expect(list.json().some((suggestion: { id: string }) => suggestion.id === suggestionId)).toBe(true);

    const detail = await app.inject({ method: 'GET', url: `/api/v1/admin/suggestions/${suggestionId}`, headers: { authorization: `Bearer ${adminToken}` } });
    expect(detail.statusCode).toBe(200);

    const update = await app.inject({ method: 'PATCH', url: `/api/v1/admin/suggestions/${suggestionId}`, headers: { authorization: `Bearer ${adminToken}` }, payload: { status: 'APPROVED', adminNotes: 'Reviewed and approved.' } });
    expect(update.statusCode).toBe(200);
    expect(update.json()).toMatchObject({ status: 'APPROVED', adminNotes: 'Reviewed and approved.', reviewedById: adminId });
    expect(update.json().user.passwordHash).toBeUndefined();
  });
});
