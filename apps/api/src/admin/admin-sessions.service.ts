import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { adminLinkMinutes } from '@portfolio/content/admin';
import { createHash, randomBytes } from 'node:crypto';
import { clientKey, networkOf } from '../common/client-key.js';
import { ClockService } from '../common/clock.service.js';
import { runEvery } from '../common/run-every.js';
import { ENV, type Env } from '../config/env.js';
import type { AdminSession } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RateLimiterService } from '../rate-limit/rate-limiter.service.js';

const cleanupEveryMs = 60 * 60 * 1000;
const linkLastsMs = adminLinkMinutes * 60 * 1000;
const sessionLastsMs = 30 * 24 * 60 * 60 * 1000;
const signInsPerTenMinutes = 5;

type SignIn =
  | { kind: 'signed in'; session: { token: string; expiresAt: Date } }
  | { kind: 'refused' }
  | { kind: 'limited'; retryAfterSeconds: number };

function newToken(): string {
  return randomBytes(32).toString('base64url');
}

function hashOf(token: string): Uint8Array<ArrayBuffer> {
  return createHash('sha256').update(token).digest();
}

@Injectable()
export class AdminSessionsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(AdminSessionsService.name);
  private stop?: () => void;

  constructor(
    private readonly prisma: PrismaService,
    private readonly limiter: RateLimiterService,
    private readonly clock: ClockService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    this.stop = runEvery(cleanupEveryMs, 'admin session cleanup', () => this.cleanup(), this.log);
  }

  onModuleDestroy(): void {
    this.stop?.();
  }

  async link(): Promise<string> {
    const token = newToken();
    const expiresAt = new Date(this.clock.now().getTime() + linkLastsMs);
    await this.prisma.adminLoginToken.create({ data: { hash: hashOf(token), expiresAt } });
    return token;
  }

  async signIn(link: string, ip: string): Promise<SignIn> {
    const now = this.clock.now();
    const client = clientKey(networkOf(ip), this.env.CLIENT_HASH_SECRET, now);
    const verdict = await this.limiter.admit(
      [{ key: `admin:10m:${client}`, limit: signInsPerTenMinutes, windowSeconds: 600 }],
      [],
    );
    if (!verdict.allowed) {
      return { kind: 'limited', retryAfterSeconds: verdict.retryAfterSeconds };
    }
    const session = { token: newToken(), expiresAt: new Date(now.getTime() + sessionLastsMs) };
    const spent = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.adminLoginToken.deleteMany({
        where: { hash: hashOf(link), expiresAt: { gt: now } },
      });
      if (count === 1) {
        await tx.adminSession.create({
          data: { hash: hashOf(session.token), expiresAt: session.expiresAt },
        });
      }
      return count === 1;
    });
    return spent ? { kind: 'signed in', session } : { kind: 'refused' };
  }

  find(token: string): Promise<AdminSession | null> {
    return this.prisma.adminSession.findUnique({
      where: { hash: hashOf(token), expiresAt: { gt: this.clock.now() } },
    });
  }

  async end({ hash }: AdminSession): Promise<void> {
    await this.prisma.adminSession.deleteMany({ where: { hash } });
  }

  async revokeAll(): Promise<{ sessions: number; links: number }> {
    const [sessions, links] = await this.prisma.$transaction([
      this.prisma.adminSession.deleteMany(),
      this.prisma.adminLoginToken.deleteMany(),
    ]);
    return { sessions: sessions.count, links: links.count };
  }

  async cleanup(): Promise<void> {
    const expired = { where: { expiresAt: { lte: this.clock.now() } } };
    await this.prisma.$transaction([
      this.prisma.adminLoginToken.deleteMany(expired),
      this.prisma.adminSession.deleteMany(expired),
    ]);
  }
}
