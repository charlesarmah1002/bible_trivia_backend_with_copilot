import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { normalizeEmail, normalizeUsername } from '../src/utils/normalize.js';

const suffix = Date.now().toString();
let userId: string;
let questionId: string;
let gameId: string;
let suggestionId: string;

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  if (suggestionId) await prisma.suggestion.delete({ where: { id: suggestionId } });
  if (gameId) await prisma.game.delete({ where: { id: gameId } });
  if (questionId) await prisma.question.delete({ where: { id: questionId } });
  if (userId) await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

describe('V1 database constraints and relationships', () => {
  it('normalizes usernames and emails before persistence and enforces uniqueness', async () => {
    const username = ` Wesley_${suffix} `;
    const email = ` USER_${suffix}@Example.COM `;
    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        normalizedUsername: normalizeUsername(username),
        email: email.trim(),
        normalizedEmail: normalizeEmail(email),
        passwordHash: 'test-hash',
      },
    });
    userId = user.id;

    expect(user.normalizedUsername).toBe(`wesley_${suffix}`);
    expect(user.normalizedEmail).toBe(`user_${suffix}@example.com`);
    await expect(
      prisma.user.create({
        data: {
          username: 'WESLEY duplicate',
          normalizedUsername: normalizeUsername(username),
          email: 'other@example.com',
          normalizedEmail: `other_${suffix}@example.com`,
          passwordHash: 'test-hash',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('supports question options, scripture references, games, answers, and ordered game questions', async () => {
    const category = await prisma.category.create({ data: { slug: `TEST_${suffix}`, name: 'Test' } });
    const question = await prisma.question.create({
      data: {
        text: 'Which book begins the New Testament?',
        difficulty: 'EASY',
        categoryId: category.id,
        explanation: 'Matthew is the first book in the New Testament.',
        published: true,
        options: {
          create: [
            { text: 'Matthew', order: 1, isCorrect: true },
            { text: 'Genesis', order: 2, isCorrect: false },
            { text: 'Acts', order: 3, isCorrect: false },
            { text: 'Romans', order: 4, isCorrect: false },
          ],
        },
        scriptureReference: { create: { book: 'Matthew', chapter: 1, verse: 1 } },
      },
      include: { options: true, scriptureReference: true },
    });
    questionId = question.id;

    expect(question.options).toHaveLength(4);
    expect(question.options.filter((option) => option.isCorrect)).toHaveLength(1);
    expect(question.scriptureReference?.book).toBe('Matthew');

    const game = await prisma.game.create({
      data: {
        userId,
        questionCount: 2,
        questions: {
          create: [
            { questionId: question.id, order: 1 },
          ],
        },
      },
      include: { questions: true },
    });
    gameId = game.id;

    const gameQuestion = game.questions[0];
    const correctOption = question.options.find((option) => option.isCorrect);
    if (!correctOption) throw new Error('Expected a correct option');

    const answer = await prisma.gameAnswer.create({
      data: {
        gameId: game.id,
        gameQuestionId: gameQuestion.id,
        selectedOptionId: correctOption.id,
        isCorrect: true,
        responseTimeMs: 1200,
        basePoints: 100,
        speedBonus: 25,
        streakBonus: 10,
        difficultyMultiplier: 1,
        points: 135,
      },
    });

    expect(answer.gameQuestionId).toBe(gameQuestion.id);
    expect(answer.selectedOptionId).toBe(correctOption.id);
    expect(gameQuestion.order).toBe(1);
  });

  it('links suggestions to their author and reviewer', async () => {
    const suggestion = await prisma.suggestion.create({
      data: {
        userId,
        type: 'QUESTION',
        title: 'Add a question',
        description: 'A test suggestion',
        suggestedQuestion: 'Who led Israel after Moses?',
        suggestedOptions: JSON.stringify(['Joshua', 'David', 'Saul', 'Elijah']),
        suggestedCorrectOption: 'Joshua',
      },
      include: { user: true },
    });
    suggestionId = suggestion.id;

    expect(suggestion.user.id).toBe(userId);
    expect(suggestion.status).toBe('PENDING');
  });

  it('keeps every seeded question at four options with one correct answer', async () => {
    const questions = await prisma.question.findMany({ include: { options: true } });

    expect(questions.length).toBeGreaterThanOrEqual(20);
    for (const question of questions) {
      expect(question.options).toHaveLength(4);
      expect(question.options.filter((option) => option.isCorrect)).toHaveLength(1);
    }
  });
});

