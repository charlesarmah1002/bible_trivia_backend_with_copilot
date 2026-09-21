import argon2 from 'argon2';
import { createHash, randomUUID } from 'node:crypto';
import type { PrismaClient, User } from '@prisma/client';
import { jwtVerify, SignJWT } from 'jose';
import type { AppConfig } from '../../config/env.js';
import { ConflictError, UnauthorizedError } from '../../utils/errors.js';
import { normalizeEmail, normalizeUsername } from '../../utils/normalize.js';
import type { AuthResponse, CurrentUser } from './types.js';
import type { LoginInput, RegisterInput } from './schemas.js';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_TTL = '30d';

export class AuthService {
  private readonly accessSecret: Uint8Array;
  private readonly refreshSecret: Uint8Array;

  constructor(
    private readonly prisma: PrismaClient,
    config: AppConfig,
  ) {
    const encoder = new TextEncoder();
    this.accessSecret = encoder.encode(config.jwtSecret);
    this.refreshSecret = encoder.encode(config.jwtRefreshSecret);
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    const username = input.username.trim();
    const email = input.email.trim();
    const normalizedUsername = normalizeUsername(username);
    const normalizedEmail = normalizeEmail(email);

    try {
      const user = await this.prisma.user.create({
        data: {
          username,
          normalizedUsername,
          email,
          normalizedEmail,
          passwordHash: await argon2.hash(input.password, { type: argon2.argon2id }),
          profile: { create: {} },
        },
      });

      return this.issueTokens(user);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError('Username or email is already in use');
      }
      throw error;
    }
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const identifier = input.identifier ?? input.username ?? input.email;
    const normalizedIdentifier = normalizeUsername(identifier ?? '');
    const normalizedEmail = normalizeEmail(identifier ?? '');
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { normalizedUsername: normalizedIdentifier },
          { normalizedEmail },
        ],
      },
    });

    if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Account is not active');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const payload = await this.verifyToken(refreshToken, this.refreshSecret, 'refresh');
    const tokenHash = hashToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt <= new Date() ||
      storedToken.userId !== payload.sub
    ) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: storedToken.userId } });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Account is not active');
    }

    const replacement = await this.createRefreshToken(user);
    const accessToken = await this.createAccessToken(user);

    await this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.refreshToken.updateMany({
        where: { id: storedToken.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (revoked.count !== 1) {
        throw new UnauthorizedError('Invalid refresh token');
      }
      await transaction.refreshToken.create({ data: replacement.record });
    });

    return { accessToken, refreshToken: replacement.token, user: toCurrentUser(user) };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async verifyAccessToken(token: string): Promise<CurrentUser> {
    const payload = await this.verifyToken(token, this.accessSecret, 'access');
    if (!payload.sub) {
      throw new UnauthorizedError('Invalid access token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Account is not active');
    }

    return toCurrentUser(user);
  }

  private async issueTokens(user: User): Promise<AuthResponse> {
    const accessToken = await this.createAccessToken(user);
    const refresh = await this.createRefreshToken(user);
    await this.prisma.refreshToken.create({ data: refresh.record });

    return { accessToken, refreshToken: refresh.token, user: toCurrentUser(user) };
  }

  private async createAccessToken(user: User): Promise<string> {
    return new SignJWT({ type: 'access', role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(ACCESS_TOKEN_TTL)
      .sign(this.accessSecret);
  }

  private async createRefreshToken(user: User): Promise<{
    token: string;
    record: { userId: string; tokenHash: string; expiresAt: Date };
  }> {
    const token = await new SignJWT({ type: 'refresh' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(REFRESH_TOKEN_TTL)
      .sign(this.refreshSecret);

    return {
      token,
      record: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    };
  }

  private async verifyToken(token: string, secret: Uint8Array, expectedType: 'access' | 'refresh') {
    try {
      const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
      if (payload.type !== expectedType || typeof payload.sub !== 'string') {
        throw new UnauthorizedError('Invalid token');
      }
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      throw new UnauthorizedError('Invalid token');
    }
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toCurrentUser(user: User): CurrentUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
