import { z } from 'zod';

export const adminIdParamsSchema = z.object({ id: z.string().trim().min(1) });
export const adminUserIdParamsSchema = adminIdParamsSchema;
export const adminGameStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED']);
export const adminSuggestionStatusSchema = z.enum(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESOLVED']);

export const adminUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  status: adminGameStatusSchema.optional(),
}).strict();

const scriptureSchema = z.object({
  book: z.string().trim().min(1).max(100),
  chapter: z.number().int().positive(),
  verse: z.number().int().positive(),
  verseEnd: z.number().int().positive().optional(),
  translation: z.string().trim().max(50).optional(),
}).strict();

const optionsSchema = z.array(z.object({
  text: z.string().trim().min(1).max(500),
  order: z.number().int().min(1).max(4),
  isCorrect: z.boolean(),
}).strict()).length(4).superRefine((options, context) => {
  if (new Set(options.map((option) => option.order)).size !== 4 || !options.every((option, index) => option.order === index + 1)) {
    context.addIssue({ code: 'custom', message: 'Options must have unique order values from 1 to 4' });
  }
  if (options.filter((option) => option.isCorrect).length !== 1) {
    context.addIssue({ code: 'custom', message: 'Exactly one option must be correct' });
  }
});

export const adminQuestionCreateSchema = z.object({
  text: z.string().trim().min(3).max(2000),
  type: z.literal('MULTIPLE_CHOICE').default('MULTIPLE_CHOICE'),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  categoryId: z.string().trim().min(1),
  explanation: z.string().trim().min(1).max(3000),
  published: z.boolean().default(false),
  options: optionsSchema,
  scripture: scriptureSchema,
}).strict();

export const adminQuestionPatchSchema = adminQuestionCreateSchema.partial().extend({
  options: optionsSchema.optional(),
  scripture: scriptureSchema.nullable().optional(),
}).strict();

export const publishQuestionSchema = z.object({ published: z.boolean() }).strict();

export const adminSuggestionPatchSchema = z.object({
  status: adminSuggestionStatusSchema.optional(),
  adminNotes: z.string().trim().max(3000).nullable().optional(),
}).strict().refine((patch) => patch.status !== undefined || patch.adminNotes !== undefined, {
  message: 'Status or adminNotes is required',
});

export type AdminQuestionCreateInput = z.infer<typeof adminQuestionCreateSchema>;
export type AdminQuestionPatchInput = z.infer<typeof adminQuestionPatchSchema>;
export type AdminSuggestionPatchInput = z.infer<typeof adminSuggestionPatchSchema>;
