import { z } from 'zod';

export const suggestionTypeSchema = z.enum([
  'QUESTION',
  'QUESTION_CORRECTION',
  'FEATURE',
  'BUG_REPORT',
  'GENERAL',
]);

const scriptureReferenceSchema = z.union([
  z.string().trim().min(1).max(200),
  z.object({
    book: z.string().trim().min(1).max(100),
    chapter: z.number().int().positive(),
    verse: z.number().int().positive(),
    verseEnd: z.number().int().positive().optional(),
    translation: z.string().trim().max(50).optional(),
  }).strict(),
]);

export const createSuggestionSchema = z
  .object({
    type: suggestionTypeSchema,
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(3).max(2000),
    suggestedQuestion: z.string().trim().min(1).max(1000).optional(),
    suggestedOptions: z.array(z.string().trim().min(1).max(200)).length(4).optional(),
    suggestedCorrectOption: z.string().trim().min(1).max(200).optional(),
    suggestedScriptureReference: scriptureReferenceSchema.optional(),
  })
  .strict()
  .superRefine((suggestion, context) => {
    if (suggestion.suggestedOptions && !suggestion.suggestedCorrectOption) {
      context.addIssue({ code: 'custom', path: ['suggestedCorrectOption'], message: 'Correct option is required when options are provided' });
    }
    if (
      suggestion.suggestedOptions &&
      suggestion.suggestedCorrectOption &&
      !suggestion.suggestedOptions.includes(suggestion.suggestedCorrectOption)
    ) {
      context.addIssue({ code: 'custom', path: ['suggestedCorrectOption'], message: 'Correct option must match one of the suggested options' });
    }
  });

export type CreateSuggestionInput = z.infer<typeof createSuggestionSchema>;
