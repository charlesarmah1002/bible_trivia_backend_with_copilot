import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { testConfig } from './helpers.js';

const suffix = Date.now().toString();
const ownerUsername = `gamer_${suffix}`;
const otherUsername = `other_${suffix}`;
let ownerId: string;
let otherId: string;
let ownerToken: string;
let otherToken: string;
let app: Awaited<ReturnType<typeof buildApp>>;
const gameIds: string[] = [];

beforeAll(async () => {
  app = await buildApp({ config: testConfig(), logger: false });
  const owner = await register(ownerUsername);
  const other = await register(otherUsername);
  ownerId = owner.user.id;
  otherId = other.user.id;
  ownerToken = owner.accessToken;
  otherToken = other.accessToken;
});

afterAll(async () => {
  await app.close();
  await prisma.game.deleteMany({ where: { id: { in: gameIds } } });
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
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

async function createGame(token = ownerToken) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/games',
    headers: { authorization: `Bearer ${token}` },
    payload: { gameType: 'SOLO', questionCount: 20 },
  });
  if (response.statusCode === 201) gameIds.push(response.json().id);
  return response;
}

describe('solo game engine', () => {
  it('creates a fixed 20-question game with unique ordered questions', async () => {
    const response = await createGame();
    const body = response.json();

    expect(response.statusCode).toBe(201);
    expect(body.totalQuestions).toBe(20);
    expect(body.currentQuestion).toBe(1);
    expect(body.progress).toBe(0.05);
    expect(body.currentQuestionData.options).toHaveLength(4);
    expect(body.currentQuestionData.options[0].isCorrect).toBeUndefined();

    const rows = await prisma.gameQuestion.findMany({ where: { gameId: body.id }, orderBy: { order: 'asc' } });
    expect(rows).toHaveLength(20);
    expect(rows.map((row) => row.order)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    expect(new Set(rows.map((row) => row.questionId)).size).toBe(20);
  });

  it('validates fixed solo game creation parameters', async () => {
    for (const payload of [
      { gameType: 'MULTIPLAYER', questionCount: 20 },
      { gameType: 'SOLO', questionCount: 10 },
      { gameType: 'SOLO', questionCount: 20, questionIds: [] },
    ]) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/games',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload,
      });
      expect(response.statusCode).toBe(400);
    }
  });

  it('enforces ownership on retrieval, answers, and results', async () => {
    const created = (await createGame()).json();
    const forbiddenRead = await app.inject({
      method: 'GET',
      url: `/api/v1/games/${created.id}`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(forbiddenRead.statusCode).toBe(404);

    const answer = await app.inject({
      method: 'POST',
      url: `/api/v1/games/${created.id}/answers`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { questionId: created.currentQuestionData.id, selectedOptionId: created.currentQuestionData.options[0].id, responseTimeMs: 1000 },
    });
    expect(answer.statusCode).toBe(404);

    const results = await app.inject({
      method: 'GET',
      url: `/api/v1/games/${created.id}/results`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(results.statusCode).toBe(404);
  });

  it('validates the current question, option ownership, and duplicate answers', async () => {
    const created = (await createGame()).json();
    const first = created.currentQuestionData;
    const wrongQuestion = (await createGame()).json().currentQuestionData;

    const manipulated = await app.inject({
      method: 'POST',
      url: `/api/v1/games/${created.id}/answers`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        questionId: first.id,
        selectedOptionId: first.options[0].id,
        responseTimeMs: 1000,
        score: 999999,
      },
    });
    expect(manipulated.statusCode).toBe(400);

    const wrongQuestionResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/games/${created.id}/answers`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { questionId: wrongQuestion.id, selectedOptionId: wrongQuestion.options[0].id, responseTimeMs: 1000 },
    });
    expect(wrongQuestionResponse.statusCode).toBe(409);

    const wrongOption = await app.inject({
      method: 'POST',
      url: `/api/v1/games/${created.id}/answers`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { questionId: first.id, selectedOptionId: wrongQuestion.options[0].id, responseTimeMs: 1000 },
    });
    expect(wrongOption.statusCode).toBe(404);

    const answer = await app.inject({
      method: 'POST',
      url: `/api/v1/games/${created.id}/answers`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { questionId: first.id, selectedOptionId: first.options[0].id, responseTimeMs: 1000 },
    });
    expect(answer.statusCode).toBe(200);
    expect(answer.json()).toMatchObject({
      questionNumber: 1,
      pointsEarned: expect.any(Number),
      currentScore: expect.any(Number),
      scoring: {
        basePoints: expect.any(Number),
        speedBonus: expect.any(Number),
        streakBonus: expect.any(Number),
        difficultyMultiplier: expect.any(Number),
        totalPoints: expect.any(Number),
      },
    });
    expect(answer.json().explanation).toBeDefined();
    expect(answer.json().scripture).toBeDefined();

    const duplicate = await app.inject({
      method: 'POST',
      url: `/api/v1/games/${created.id}/answers`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { questionId: first.id, selectedOptionId: first.options[0].id, responseTimeMs: 1000 },
    });
    expect(duplicate.statusCode).toBe(409);
  });

  it('tracks a longest streak separately and resets only the current streak', async () => {
    const created = (await createGame()).json();

    for (let index = 0; index < 10; index += 1) {
      const current = await app.inject({
        method: 'GET',
        url: `/api/v1/games/${created.id}`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      const question = current.json().currentQuestionData;
      const record = await prisma.question.findUniqueOrThrow({
        where: { id: question.id },
        include: { options: true },
      });
      const correctOption = record.options.find((option) => option.isCorrect);
      if (!correctOption) throw new Error('Expected a correct option');

      const answer = await app.inject({
        method: 'POST',
        url: `/api/v1/games/${created.id}/answers`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { questionId: question.id, selectedOptionId: correctOption.id, responseTimeMs: 1000 },
      });
      expect(answer.statusCode).toBe(200);
    }

    const afterStreak = await app.inject({
      method: 'GET',
      url: `/api/v1/games/${created.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(afterStreak.json()).toMatchObject({ currentStreak: 10, longestStreak: 10 });

    const question = afterStreak.json().currentQuestionData;
    const record = await prisma.question.findUniqueOrThrow({ where: { id: question.id }, include: { options: true } });
    const incorrectOption = record.options.find((option) => !option.isCorrect);
    if (!incorrectOption) throw new Error('Expected an incorrect option');
    const reset = await app.inject({
      method: 'POST',
      url: `/api/v1/games/${created.id}/answers`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { questionId: question.id, selectedOptionId: incorrectOption.id, responseTimeMs: 1000 },
    });
    expect(reset.statusCode).toBe(200);

    const afterReset = await app.inject({
      method: 'GET',
      url: `/api/v1/games/${created.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(afterReset.json()).toMatchObject({ currentStreak: 0, longestStreak: 10 });
  });

  it('automatically completes after the twentieth answer and returns results', async () => {
    const created = (await createGame()).json();
    let game = created;
    let lastAnswer: ReturnType<typeof JSON.parse> | undefined;

    for (let index = 0; index < 20; index += 1) {
      const question = game.currentQuestionData;
      expect(question).toBeDefined();
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/games/${created.id}/answers`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { questionId: question.id, selectedOptionId: question.options[0].id, responseTimeMs: 1500 },
      });
      expect(response.statusCode).toBe(200);
      lastAnswer = response.json();
      if (index < 19) {
        expect(lastAnswer?.completed).toBe(false);
        const current = await app.inject({
          method: 'GET',
          url: `/api/v1/games/${created.id}`,
          headers: { authorization: `Bearer ${ownerToken}` },
        });
        game = current.json();
      }
    }

    expect(lastAnswer?.completed).toBe(true);
    expect(lastAnswer?.nextQuestion).toBeNull();

    const completed = await app.inject({
      method: 'GET',
      url: `/api/v1/games/${created.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(completed.json()).toMatchObject({ status: 'COMPLETED', currentQuestion: 20, progress: 1 });

    const results = await app.inject({
      method: 'GET',
      url: `/api/v1/games/${created.id}/results`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(results.statusCode).toBe(200);
    expect(results.json()).toMatchObject({ gameId: created.id, correctAnswers: expect.any(Number), totalScore: expect.any(Number) });

    const afterCompletion = await app.inject({
      method: 'POST',
      url: `/api/v1/games/${created.id}/answers`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { questionId: created.currentQuestionData.id, selectedOptionId: created.currentQuestionData.options[0].id, responseTimeMs: 1000 },
    });
    expect(afterCompletion.statusCode).toBe(409);
  });

  it('prevents double completion and supports explicit completion', async () => {
    const created = (await createGame()).json();
    const complete = await app.inject({
      method: 'POST',
      url: `/api/v1/games/${created.id}/complete`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(complete.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/games/${created.id}/complete`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(second.statusCode).toBe(409);
  });
});
