import type { Prisma, PrismaClient } from '@prisma/client';
import { ConflictError, NotFoundError } from '../../utils/errors.js';
import type { AdminQuestionCreateInput, AdminQuestionPatchInput, AdminSuggestionPatchInput } from './schemas.js';

const safeUserSelect = {
  id: true,
  username: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
  profile: { select: { displayName: true, avatarUrl: true, bio: true } },
} as const;

const adminQuestionSelect = {
  id: true,
  text: true,
  type: true,
  difficulty: true,
  explanation: true,
  published: true,
  archived: true,
  category: { select: { id: true, slug: true, name: true } },
  options: { select: { id: true, text: true, order: true, isCorrect: true }, orderBy: { order: 'asc' as const } },
  scriptureReference: true,
} as const;

const adminSuggestionSelect = {
  id: true,
  userId: true,
  type: true,
  title: true,
  description: true,
  status: true,
  suggestedQuestion: true,
  suggestedOptions: true,
  suggestedCorrectOption: true,
  suggestedScriptureReference: true,
  adminNotes: true,
  reviewedById: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, username: true } },
  reviewedBy: { select: { id: true, username: true } },
} as const;

export class AdminService {
  constructor(private readonly prisma: PrismaClient) {}

  async dashboard() {
    const [totalUsers, activeUsers, suspendedUsers, disabledUsers, totalGames, completedGames, totalQuestions, publishedQuestions, pendingSuggestions, totalAnswers, correctAnswers] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.user.count({ where: { status: 'DISABLED' } }),
      this.prisma.game.count(),
      this.prisma.game.count({ where: { status: 'COMPLETED' } }),
      this.prisma.question.count({ where: { archived: false } }),
      this.prisma.question.count({ where: { published: true, archived: false } }),
      this.prisma.suggestion.count({ where: { status: 'PENDING' } }),
      this.prisma.gameAnswer.count(),
      this.prisma.gameAnswer.count({ where: { isCorrect: true } }),
    ]);

    return { totalUsers, activeUsers, suspendedUsers, disabledUsers, totalGames, completedGames, totalQuestions, publishedQuestions, pendingSuggestions, totalAnswers, correctAnswers };
  }

  async listUsers(query: { page: number; limit: number; search?: string; status?: string }) {
    const where: Prisma.UserWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { OR: [{ username: { contains: query.search } }, { normalizedUsername: { contains: query.search.toLowerCase() } }, { email: { contains: query.search } }, { normalizedEmail: { contains: query.search.toLowerCase() } }] } : {}),
    };
    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({ where, select: safeUserSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.limit, take: query.limit }),
    ]);
    return { data: users, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { ...safeUserSelect, _count: { select: { games: true, suggestions: true } } } });
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  async updateUserStatus(id: string, status: string) {
    try {
      return await this.prisma.user.update({ where: { id }, data: { status }, select: safeUserSelect });
    } catch (error) {
      if (isNotFound(error)) throw new NotFoundError('User not found');
      throw error;
    }
  }

  async createQuestion(input: AdminQuestionCreateInput) {
    await this.ensureCategory(input.categoryId);
    return this.prisma.question.create({
      data: {
        text: input.text, type: input.type, difficulty: input.difficulty, categoryId: input.categoryId,
        explanation: input.explanation, published: input.published,
        options: { create: input.options },
        scriptureReference: { create: input.scripture },
      },
      select: adminQuestionSelect,
    });
  }

  async updateQuestion(id: string, input: AdminQuestionPatchInput) {
    const existing = await this.prisma.question.findUnique({ where: { id }, include: { options: true, scriptureReference: true } });
    if (!existing) throw new NotFoundError('Question not found');
    if (input.categoryId) await this.ensureCategory(input.categoryId);
    if (input.published && existing.archived) throw new ConflictError('Archived questions must be restored before publishing');

    return this.prisma.$transaction(async (transaction) => {
      if (input.options) await transaction.questionOption.deleteMany({ where: { questionId: id } });
      await transaction.question.update({
        where: { id },
        data: {
          ...(input.text !== undefined ? { text: input.text } : {}),
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.difficulty !== undefined ? { difficulty: input.difficulty } : {}),
          ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
          ...(input.explanation !== undefined ? { explanation: input.explanation } : {}),
          ...(input.published !== undefined ? { published: input.published } : {}),
          ...(input.options ? { options: { create: input.options } } : {}),
          ...(input.scripture === null ? { scriptureReference: { delete: true } } : {}),
          ...(input.scripture ? { scriptureReference: { upsert: { create: input.scripture, update: input.scripture } } } : {}),
        },
      });
      return transaction.question.findUniqueOrThrow({ where: { id }, select: adminQuestionSelect });
    });
  }

  async archiveQuestion(id: string) {
    try {
      return await this.prisma.question.update({ where: { id }, data: { archived: true, published: false }, select: adminQuestionSelect });
    } catch (error) {
      if (isNotFound(error)) throw new NotFoundError('Question not found');
      throw error;
    }
  }

  async publishQuestion(id: string, published: boolean) {
    const question = await this.prisma.question.findUnique({ where: { id }, select: { archived: true } });
    if (!question) throw new NotFoundError('Question not found');
    if (published && question.archived) throw new ConflictError('Archived questions cannot be published');
    return this.prisma.question.update({ where: { id }, data: { published }, select: adminQuestionSelect });
  }

  async listSuggestions() {
    const suggestions = await this.prisma.suggestion.findMany({ select: adminSuggestionSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    return suggestions.map(toAdminSuggestion);
  }

  async getSuggestion(id: string) {
    const suggestion = await this.prisma.suggestion.findUnique({ where: { id }, select: adminSuggestionSelect });
    if (!suggestion) throw new NotFoundError('Suggestion not found');
    return toAdminSuggestion(suggestion);
  }

  async updateSuggestion(id: string, adminId: string, input: AdminSuggestionPatchInput) {
    try {
      const suggestion = await this.prisma.suggestion.update({ where: { id }, data: { ...(input.status !== undefined ? { status: input.status } : {}), ...(input.adminNotes !== undefined ? { adminNotes: input.adminNotes } : {}), reviewedById: adminId, reviewedAt: new Date() }, select: adminSuggestionSelect });
      return toAdminSuggestion(suggestion);
    } catch (error) {
      if (isNotFound(error)) throw new NotFoundError('Suggestion not found');
      throw error;
    }
  }

  private async ensureCategory(id: string): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id }, select: { id: true } });
    if (!category) throw new NotFoundError('Category not found');
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025';
}

function toAdminSuggestion(suggestion: any) {
  return {
    ...suggestion,
    suggestedOptions: parseJson(suggestion.suggestedOptions),
    suggestedScriptureReference: parseJson(suggestion.suggestedScriptureReference),
  };
}

function parseJson(value: string | null): unknown {
  if (!value) return null;
  try { return JSON.parse(value) as unknown; } catch { return value; }
}
