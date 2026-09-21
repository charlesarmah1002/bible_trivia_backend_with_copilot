import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { testConfig } from './helpers.js';

const suffix = Date.now().toString();
let app: Awaited<ReturnType<typeof buildApp>>;
let aliceId: string;
let bobId: string;
let aliceToken: string;
let bobToken: string;
const suggestionIds: string[] = [];

beforeAll(async () => {
  app = await buildApp({ config: testConfig(), logger: false });
  const alice = await register(`suggestion_alice_${suffix}`);
  const bob = await register(`suggestion_bob_${suffix}`);
  aliceId = alice.user.id;
  bobId = bob.user.id;
  aliceToken = alice.accessToken;
  bobToken = bob.accessToken;
});

afterAll(async () => {
  await app.close();
  await prisma.suggestion.deleteMany({ where: { id: { in: suggestionIds } } });
  await prisma.user.deleteMany({ where: { id: { in: [aliceId, bobId] } } });
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

const questionSuggestion = {
  type: 'QUESTION',
  title: 'Add a question about Joshua',
  description: 'This would help players review the transition after Moses.',
  suggestedQuestion: 'Who succeeded Moses as leader of Israel?',
  suggestedOptions: ['Joshua', 'David', 'Samuel', 'Elijah'],
  suggestedCorrectOption: 'Joshua',
  suggestedScriptureReference: { book: 'Joshua', chapter: 1, verse: 1, verseEnd: 9 },
};

describe('user suggestions', () => {
  it('requires authentication to create and list suggestions', async () => {
    const create = await app.inject({ method: 'POST', url: '/api/v1/suggestions', payload: questionSuggestion });
    const list = await app.inject({ method: 'GET', url: '/api/v1/suggestions/me' });

    expect(create.statusCode).toBe(401);
    expect(list.statusCode).toBe(401);
  });

  it('creates a validated suggestion with PENDING status', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/suggestions',
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: questionSuggestion,
    });
    const body = response.json();
    suggestionIds.push(body.id);

    expect(response.statusCode).toBe(201);
    expect(body).toMatchObject({
      type: 'QUESTION',
      title: questionSuggestion.title,
      status: 'PENDING',
      suggestedOptions: questionSuggestion.suggestedOptions,
      suggestedCorrectOption: 'Joshua',
      suggestedScriptureReference: questionSuggestion.suggestedScriptureReference,
    });
    expect(body.userId).toBeUndefined();
    expect(body.adminNotes).toBeUndefined();
    expect(body.reviewedBy).toBeUndefined();
    expect(body.reviewedAt).toBeUndefined();

    const stored = await prisma.suggestion.findUnique({ where: { id: body.id } });
    expect(stored).toMatchObject({ userId: aliceId, status: 'PENDING', reviewedById: null, reviewedAt: null, adminNotes: null });
  });

  it('rejects invalid types, incomplete options, mismatched answers, and admin fields', async () => {
    const invalidPayloads = [
      { ...questionSuggestion, type: 'NOT_A_TYPE' },
      { ...questionSuggestion, suggestedOptions: ['Only one'] },
      { ...questionSuggestion, suggestedCorrectOption: 'Moses' },
      { ...questionSuggestion, status: 'APPROVED' },
      { ...questionSuggestion, reviewedBy: 'admin-id' },
      { ...questionSuggestion, reviewedAt: new Date().toISOString() },
      { ...questionSuggestion, adminNotes: 'approve this' },
    ];

    for (const payload of invalidPayloads) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/suggestions',
        headers: { authorization: `Bearer ${aliceToken}` },
        payload,
      });
      expect(response.statusCode).toBe(400);
    }
  });

  it('returns only the authenticated user submissions', async () => {
    const bobResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/suggestions',
      headers: { authorization: `Bearer ${bobToken}` },
      payload: { ...questionSuggestion, type: 'FEATURE', title: 'Add a practice mode' },
    });
    suggestionIds.push(bobResponse.json().id);

    const aliceList = await app.inject({
      method: 'GET',
      url: '/api/v1/suggestions/me',
      headers: { authorization: `Bearer ${aliceToken}` },
    });
    const bobList = await app.inject({
      method: 'GET',
      url: '/api/v1/suggestions/me',
      headers: { authorization: `Bearer ${bobToken}` },
    });

    expect(aliceList.statusCode).toBe(200);
    expect(bobList.statusCode).toBe(200);
    expect(aliceList.json()).toHaveLength(1);
    expect(bobList.json()).toHaveLength(1);
    expect(aliceList.json()[0].title).toBe(questionSuggestion.title);
    expect(bobList.json()[0].title).toBe('Add a practice mode');
    expect(JSON.stringify(aliceList.json())).not.toContain(bobId);
    expect(JSON.stringify(bobList.json())).not.toContain(aliceId);
  });
});
