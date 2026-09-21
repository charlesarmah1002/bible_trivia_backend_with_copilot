import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { testConfig } from './helpers.js';

const marker = Date.now().toString();
let unpublishedQuestionId: string;
let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  app = await buildApp({ config: testConfig(), logger: false });
  const category = await prisma.category.findUniqueOrThrow({ where: { slug: 'GENERAL' } });
  const unpublished = await prisma.question.create({
    data: {
      text: `Unpublished question ${marker}`,
      type: 'MULTIPLE_CHOICE',
      difficulty: 'HARD',
      categoryId: category.id,
      explanation: 'This should not be public.',
      published: false,
      options: {
        create: [
          { text: 'One', order: 1, isCorrect: true },
          { text: 'Two', order: 2, isCorrect: false },
          { text: 'Three', order: 3, isCorrect: false },
          { text: 'Four', order: 4, isCorrect: false },
        ],
      },
      scriptureReference: { create: { book: 'Genesis', chapter: 1, verse: 1 } },
    },
  });
  unpublishedQuestionId = unpublished.id;
});

afterAll(async () => {
  await app.close();
  await prisma.question.delete({ where: { id: unpublishedQuestionId } });
  await prisma.$disconnect();
});

describe('public question API', () => {
  it('returns published questions with four safe options and no answer key', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/questions?limit=100' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data.length).toBeGreaterThanOrEqual(20);
    expect(body.data.every((question: { text: string }) => !question.text.includes(marker))).toBe(true);

    for (const question of body.data) {
      expect(question.options).toHaveLength(4);
      for (const option of question.options) {
        expect(Object.keys(option).sort()).toEqual(['id', 'order', 'text']);
        expect(option.isCorrect).toBeUndefined();
      }
      expect(question.scripture).toBeDefined();
      expect(question.isCorrect).toBeUndefined();
    }
  });

  it('supports pagination', async () => {
    const first = await app.inject({ method: 'GET', url: '/api/v1/questions?page=1&limit=2' });
    const second = await app.inject({ method: 'GET', url: '/api/v1/questions?page=2&limit=2' });
    const firstBody = first.json();
    const secondBody = second.json();

    expect(first.statusCode).toBe(200);
    expect(firstBody.data).toHaveLength(2);
    expect(secondBody.data).toHaveLength(2);
    expect(firstBody.pagination).toMatchObject({ page: 1, limit: 2 });
    expect(secondBody.pagination).toMatchObject({ page: 2, limit: 2 });
    expect(firstBody.data[0].id).not.toBe(secondBody.data[0].id);
  });

  it('filters by category, difficulty, and question type', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/questions?category=OLD_TESTAMENT&difficulty=EASY&type=MULTIPLE_CHOICE&limit=100',
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every((question: { category: { slug: string }; difficulty: string; type: string }) =>
      question.category.slug === 'OLD_TESTAMENT' && question.difficulty === 'EASY' && question.type === 'MULTIPLE_CHOICE')).toBe(true);
  });

  it('rejects invalid and externally supplied publication filters', async () => {
    for (const query of [
      'difficulty=IMPOSSIBLE',
      'page=0',
      'limit=101',
      'published=false',
    ]) {
      const response = await app.inject({ method: 'GET', url: `/api/v1/questions?${query}` });
      expect(response.statusCode).toBe(400);
    }
  });

  it('returns a published question by id without the answer key', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/v1/questions?limit=1' });
    const question = list.json().data[0];
    const response = await app.inject({ method: 'GET', url: `/api/v1/questions/${question.id}` });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.id).toBe(question.id);
    expect(body.options).toHaveLength(4);
    expect(JSON.stringify(body)).not.toContain('isCorrect');
  });

  it('hides unpublished and nonexistent questions', async () => {
    const unpublished = await app.inject({ method: 'GET', url: `/api/v1/questions/${unpublishedQuestionId}` });
    const missing = await app.inject({ method: 'GET', url: '/api/v1/questions/not-a-real-question' });

    expect(unpublished.statusCode).toBe(404);
    expect(missing.statusCode).toBe(404);
  });
});
