import type { Game, Prisma, PrismaClient } from '@prisma/client';
import { ConflictError, NotFoundError } from '../../utils/errors.js';
import type { SubmitAnswerInput } from './schemas.js';
import { ScoringService, type Difficulty } from './scoring.js';
const publicQuestionSelect = {
  id: true,
  text: true,
  type: true,
  difficulty: true,
  options: {
    select: { id: true, text: true, order: true },
    orderBy: { order: 'asc' as const },
  },
  scriptureReference: {
    select: { book: true, chapter: true, verse: true, verseEnd: true, translation: true },
  },
} satisfies Prisma.QuestionSelect;

const gameQuestionSelect = {
  ...publicQuestionSelect,
  explanation: true,
  options: {
    select: { id: true, text: true, order: true, isCorrect: true },
    orderBy: { order: 'asc' as const },
  },
} satisfies Prisma.QuestionSelect;

type PublicQuestion = Prisma.QuestionGetPayload<{ select: typeof publicQuestionSelect }>;
type GameQuestionRecord = Prisma.QuestionGetPayload<{ select: typeof gameQuestionSelect }>;

type GameWithQuestions = Prisma.GameGetPayload<{
  include: {
    questions: { include: { question: { select: typeof gameQuestionSelect } } };
  };
}>;

export class GameService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly scoringService = new ScoringService(),
  ) {}

  async createSoloGame(userId: string) {
    const eligibleQuestions = await this.prisma.question.findMany({
      where: { published: true, archived: false, type: 'MULTIPLE_CHOICE' },
      select: { id: true },
    });

    if (eligibleQuestions.length < 20) {
      throw new ConflictError('Not enough published questions to start a game');
    }

    const selectedQuestions = shuffle(eligibleQuestions).slice(0, 20);
    const game = await this.prisma.game.create({
      data: {
        userId,
        gameType: 'SOLO',
        questionCount: 20,
        questions: {
          create: selectedQuestions.map((question, index) => ({
            questionId: question.id,
            order: index + 1,
          })),
        },
      },
    });

    return this.getGame(userId, game.id);
  }

  async getGame(userId: string, gameId: string) {
    const game = await this.findGame(userId, gameId);
    return toGameView(game);
  }

  async submitAnswer(userId: string, gameId: string, input: SubmitAnswerInput) {
    return this.prisma.$transaction(async (transaction) => {
      const game = await this.findGame(userId, gameId, transaction);
      if (game.status !== 'IN_PROGRESS') {
        throw new ConflictError('Game is no longer in progress');
      }

      const currentGameQuestion = game.questions.find(
        (gameQuestion) => gameQuestion.order === game.currentQuestionIndex + 1,
      );
      if (!currentGameQuestion || currentGameQuestion.questionId !== input.questionId) {
        throw new ConflictError('Question is not the current game question');
      }

      const selectedOption = currentGameQuestion.question.options.find(
        (option) => option.id === input.selectedOptionId,
      );
      if (!selectedOption) {
        throw new NotFoundError('Option does not belong to this question');
      }

      const existingAnswer = await transaction.gameAnswer.findFirst({
        where: { gameId, gameQuestionId: currentGameQuestion.id },
        select: { id: true },
      });
      if (existingAnswer) {
        throw new ConflictError('Question has already been answered');
      }

      const isCorrect = selectedOption.isCorrect;
      const scoring = this.scoringService.calculateAnswerScore(
        currentGameQuestion.question.difficulty as Difficulty,
        input.responseTimeMs,
        game.currentStreak,
        isCorrect,
      );
      const nextQuestionIndex = game.currentQuestionIndex + 1;
      const isComplete = nextQuestionIndex >= game.questionCount;
      const completedAt = isComplete ? new Date() : undefined;

      await transaction.gameAnswer.create({
        data: {
          gameId,
          gameQuestionId: currentGameQuestion.id,
          selectedOptionId: selectedOption.id,
          isCorrect,
          responseTimeMs: input.responseTimeMs,
          basePoints: scoring.basePoints,
          speedBonus: scoring.speedBonus,
          streakBonus: scoring.streakBonus,
          difficultyMultiplier: scoring.difficultyMultiplier,
          points: scoring.totalPoints,
        },
      });

      const updatedGame = await transaction.game.update({
        where: { id: gameId },
        data: {
          currentQuestionIndex: nextQuestionIndex,
          score: { increment: scoring.totalPoints },
          correctAnswers: { increment: isCorrect ? 1 : 0 },
          incorrectAnswers: { increment: isCorrect ? 0 : 1 },
          currentStreak: scoring.nextStreak,
          longestStreak: Math.max(game.longestStreak, scoring.nextStreak),
          ...(isComplete ? { status: 'COMPLETED', completedAt } : {}),
        },
      });

      if (isComplete) {
        await createGameResult(transaction, updatedGame);
      }

      const nextGameQuestion = game.questions.find((item) => item.order === nextQuestionIndex + 1);
      return {
        correct: isCorrect,
        selectedAnswer: { id: selectedOption.id, text: selectedOption.text, order: selectedOption.order },
        explanation: currentGameQuestion.question.explanation,
        scripture: currentGameQuestion.question.scriptureReference,
        pointsEarned: scoring.totalPoints,
        scoring: {
          basePoints: scoring.basePoints,
          speedBonus: scoring.speedBonus,
          streakBonus: scoring.streakBonus,
          difficultyMultiplier: scoring.difficultyMultiplier,
          totalPoints: scoring.totalPoints,
        },
        currentScore: updatedGame.score,
        currentStreak: updatedGame.currentStreak,
        completed: isComplete,
        questionNumber: currentGameQuestion.order,
        nextQuestionNumber: isComplete ? null : nextQuestionIndex + 1,
        nextQuestion: nextGameQuestion ? toPublicQuestion(nextGameQuestion.question) : null,
      };
    });
  }

  async completeGame(userId: string, gameId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const game = await this.findGame(userId, gameId, transaction);
      if (game.status !== 'IN_PROGRESS') {
        throw new ConflictError('Game is already completed');
      }

      const completedAt = new Date();
      const updatedGame = await transaction.game.update({
        where: { id: gameId },
        data: { status: 'COMPLETED', completedAt },
      });
      return createGameResult(transaction, updatedGame);
    });
  }

  async getResults(userId: string, gameId: string) {
    const result = await this.prisma.gameResult.findFirst({
      where: { gameId, game: { userId } },
      select: {
        id: true,
        gameId: true,
        totalScore: true,
        correctAnswers: true,
        incorrectAnswers: true,
        accuracy: true,
        longestStreak: true,
        completedAt: true,
      },
    });
    if (!result) throw new NotFoundError('Game results not found');
    return result;
  }

  private async findGame(userId: string, gameId: string, transaction: PrismaClient | Prisma.TransactionClient = this.prisma): Promise<GameWithQuestions> {
    const game = await transaction.game.findFirst({
      where: { id: gameId, userId },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { question: { select: gameQuestionSelect } },
        },
      },
    });
    if (!game) throw new NotFoundError('Game not found');
    return game;
  }
}

async function createGameResult(
  transaction: PrismaClient | Prisma.TransactionClient,
  game: Pick<Game, 'id' | 'questionCount' | 'score' | 'correctAnswers' | 'incorrectAnswers' | 'longestStreak' | 'completedAt'>,
) {
  const accuracy = game.questionCount === 0 ? 0 : (game.correctAnswers / game.questionCount) * 100;
  return transaction.gameResult.create({
    data: {
      gameId: game.id,
      totalScore: game.score,
      correctAnswers: game.correctAnswers,
      incorrectAnswers: game.incorrectAnswers,
      accuracy,
      longestStreak: game.longestStreak,
      completedAt: game.completedAt ?? new Date(),
    },
    select: {
      id: true,
      gameId: true,
      totalScore: true,
      correctAnswers: true,
      incorrectAnswers: true,
      accuracy: true,
      longestStreak: true,
      completedAt: true,
    },
  });
}

function toGameView(game: GameWithQuestions) {
  const currentGameQuestion = game.questions.find((item) => item.order === game.currentQuestionIndex + 1);
  return {
    id: game.id,
    status: game.status,
    questionCount: game.questionCount,
    currentQuestion: Math.min(game.currentQuestionIndex + 1, game.questionCount),
    totalQuestions: game.questionCount,
    progress: game.questionCount === 0 ? 0 : Math.min((game.currentQuestionIndex + 1) / game.questionCount, 1),
    score: game.score,
    currentStreak: game.currentStreak,
    longestStreak: game.longestStreak,
    currentQuestionData: currentGameQuestion ? toPublicQuestion(currentGameQuestion.question) : null,
    startedAt: game.startedAt,
    completedAt: game.completedAt,
  };
}

function toPublicQuestion(question: PublicQuestion | GameQuestionRecord) {
  return {
    id: question.id,
    text: question.text,
    type: question.type,
    difficulty: question.difficulty,
    options: question.options.map(({ id, text, order }) => ({ id, text, order })),
    scripture: question.scriptureReference,
  };
}

function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
