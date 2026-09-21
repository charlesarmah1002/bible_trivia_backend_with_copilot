import type { Prisma, PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../utils/errors.js';
import type { QuestionQuery } from './schemas.js';

const publicQuestionSelect = {
  id: true,
  text: true,
  type: true,
  difficulty: true,
  category: { select: { slug: true, name: true } },
  options: {
    select: { id: true, text: true, order: true },
    orderBy: { order: 'asc' as const },
  },
  scriptureReference: {
    select: { book: true, chapter: true, verse: true, verseEnd: true, translation: true },
  },
} satisfies Prisma.QuestionSelect;

type PublicQuestionRecord = Prisma.QuestionGetPayload<{ select: typeof publicQuestionSelect }>;

export class QuestionService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(query: QuestionQuery) {
    const where: Prisma.QuestionWhereInput = {
      published: true,
      archived: false,
      ...(query.difficulty ? { difficulty: query.difficulty } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.category ? { category: { slug: query.category } } : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [total, questions] = await this.prisma.$transaction([
      this.prisma.question.count({ where }),
      this.prisma.question.findMany({
        where,
        select: publicQuestionSelect,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip,
        take: query.limit,
      }),
    ]);

    return {
      data: questions.map(toPublicQuestion),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getById(id: string) {
    const question = await this.prisma.question.findFirst({
      where: { id, published: true, archived: false },
      select: publicQuestionSelect,
    });
    if (!question) throw new NotFoundError('Question not found');
    return toPublicQuestion(question);
  }
}

function toPublicQuestion(question: PublicQuestionRecord) {
  return {
    id: question.id,
    text: question.text,
    type: question.type,
    difficulty: question.difficulty,
    category: question.category,
    options: question.options,
    scripture: question.scriptureReference,
  };
}
