import type { PrismaClient } from '@prisma/client';
import type { LeaderboardQuery } from './schemas.js';

type LeaderboardRow = {
  userId: string;
  username: string;
  normalizedUsername: string;
  score: number;
  gamesPlayed: number;
  correctAnswers: number;
  totalAnswers: number;
};

export class LeaderboardService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(query: LeaderboardQuery) {
    const rows = await this.getRankedRows(query.scope);
    const skip = (query.page - 1) * query.limit;
    const data = rows.slice(skip, skip + query.limit).map((row, index) => toPublicRow(row, skip + index + 1));

    return {
      scope: query.scope,
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: rows.length,
        totalPages: Math.ceil(rows.length / query.limit),
      },
    };
  }

  async getMyRank(userId: string, scope: LeaderboardQuery['scope']) {
    const rows = await this.getRankedRows(scope);
    const index = rows.findIndex((row) => row.userId === userId);
    if (index === -1) {
      return { scope, rank: null, entry: null };
    }

    return {
      scope,
      rank: index + 1,
      entry: toPublicRow(rows[index], index + 1),
    };
  }

  private async getRankedRows(scope: LeaderboardQuery['scope']): Promise<LeaderboardRow[]> {
    const results = await this.prisma.gameResult.findMany({
      where: {
        completedAt: scope === 'weekly' ? { gte: startOfUtcWeek() } : undefined,
        game: {
          status: 'COMPLETED',
          user: { status: 'ACTIVE' },
        },
      },
      select: {
        totalScore: true,
        correctAnswers: true,
        incorrectAnswers: true,
        game: {
          select: {
            user: { select: { id: true, username: true, normalizedUsername: true } },
          },
        },
      },
    });

    const byUser = new Map<string, LeaderboardRow>();
    for (const result of results) {
      const user = result.game.user;
      const existing = byUser.get(user.id) ?? {
        userId: user.id,
        username: user.username,
        normalizedUsername: user.normalizedUsername,
        score: 0,
        gamesPlayed: 0,
        correctAnswers: 0,
        totalAnswers: 0,
      };
      existing.score += result.totalScore;
      existing.gamesPlayed += 1;
      existing.correctAnswers += result.correctAnswers;
      existing.totalAnswers += result.correctAnswers + result.incorrectAnswers;
      byUser.set(user.id, existing);
    }

    return [...byUser.values()].sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const leftAccuracy = accuracy(left);
      const rightAccuracy = accuracy(right);
      if (rightAccuracy !== leftAccuracy) return rightAccuracy - leftAccuracy;
      if (right.gamesPlayed !== left.gamesPlayed) return right.gamesPlayed - left.gamesPlayed;
      return left.normalizedUsername.localeCompare(right.normalizedUsername);
    });
  }
}

function toPublicRow(row: LeaderboardRow, rank: number) {
  return {
    rank,
    username: row.username,
    score: row.score,
    gamesPlayed: row.gamesPlayed,
    accuracy: Number(accuracy(row).toFixed(1)),
  };
}

function accuracy(row: LeaderboardRow): number {
  return row.totalAnswers === 0 ? 0 : (row.correctAnswers / row.totalAnswers) * 100;
}

function startOfUtcWeek(now = new Date()): Date {
  const day = now.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start;
}
