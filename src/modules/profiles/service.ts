import type { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../utils/errors.js';
import { normalizeUsername } from '../../utils/normalize.js';
import type { UpdateProfileInput } from './schemas.js';

const profileSelect = {
  displayName: true,
  avatarUrl: true,
  bio: true,
} as const;

const accountSelect = {
  id: true,
  username: true,
  email: true,
  role: true,
  status: true,
  profile: { select: profileSelect },
} as const;

export class ProfileService {
  constructor(private readonly prisma: PrismaClient) {}

  async getCurrentProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: accountSelect });
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  async updateCurrentProfile(userId: string, input: UpdateProfileInput) {
    await this.ensureUser(userId);

    return this.prisma.user.update({
      where: { id: userId },
      data: { profile: { update: input } },
      select: accountSelect,
    });
  }

  async getPublicProfile(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { normalizedUsername: normalizeUsername(username) },
      select: {
        id: true,
        username: true,
        profile: { select: { displayName: true, avatarUrl: true, bio: true } },
      },
    });
    if (!user) throw new NotFoundError('User not found');

    const stats = await this.prisma.gameResult.aggregate({
      where: { game: { userId: user.id } },
      _count: { _all: true },
      _sum: { totalScore: true },
      _avg: { accuracy: true },
    });

    return {
      username: user.username,
      profile: user.profile,
      gamesPlayed: stats._count._all,
      totalScore: stats._sum.totalScore ?? 0,
      accuracy: Number((stats._avg.accuracy ?? 0).toFixed(1)),
    };
  }

  private async ensureUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundError('User not found');
  }
}
