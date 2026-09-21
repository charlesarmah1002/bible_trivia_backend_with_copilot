import type { PrismaClient } from '@prisma/client';
import type { CreateSuggestionInput } from './schemas.js';

const suggestionSelect = {
  id: true,
  type: true,
  title: true,
  description: true,
  status: true,
  suggestedQuestion: true,
  suggestedOptions: true,
  suggestedCorrectOption: true,
  suggestedScriptureReference: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class SuggestionService {
  constructor(private readonly prisma: PrismaClient) {}

  async create(userId: string, input: CreateSuggestionInput) {
    const suggestion = await this.prisma.suggestion.create({
      data: {
        userId,
        type: input.type,
        title: input.title,
        description: input.description,
        suggestedQuestion: input.suggestedQuestion,
        suggestedOptions: input.suggestedOptions ? JSON.stringify(input.suggestedOptions) : undefined,
        suggestedCorrectOption: input.suggestedCorrectOption,
        suggestedScriptureReference: input.suggestedScriptureReference
          ? JSON.stringify(input.suggestedScriptureReference)
          : undefined,
      },
      select: suggestionSelect,
    });

    return toPublicSuggestion(suggestion);
  }

  async listMine(userId: string) {
    const suggestions = await this.prisma.suggestion.findMany({
      where: { userId },
      select: suggestionSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return suggestions.map(toPublicSuggestion);
  }
}

function toPublicSuggestion(suggestion: {
  id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  suggestedQuestion: string | null;
  suggestedOptions: string | null;
  suggestedCorrectOption: string | null;
  suggestedScriptureReference: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: suggestion.id,
    type: suggestion.type,
    title: suggestion.title,
    description: suggestion.description,
    status: suggestion.status,
    suggestedQuestion: suggestion.suggestedQuestion,
    suggestedOptions: parseJson(suggestion.suggestedOptions),
    suggestedCorrectOption: suggestion.suggestedCorrectOption,
    suggestedScriptureReference: parseJson(suggestion.suggestedScriptureReference),
    createdAt: suggestion.createdAt,
    updatedAt: suggestion.updatedAt,
  };
}

function parseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}
