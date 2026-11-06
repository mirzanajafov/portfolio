import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ClockService } from '../common/clock.service.js';
import { runEvery } from '../common/run-every.js';
import { PrismaService } from '../prisma/prisma.service.js';

const cleanupEveryMs = 60 * 60 * 1000;
const keepMs = 2 * 24 * 60 * 60 * 1000;

export type Limited = { kind: 'limited'; retryAfterSeconds: number };

export type Verdict = { kind: 'allowed' } | Limited;

type Limit = { key: string; limit: number; windowSeconds: number };

@Injectable()
export class RateLimiterService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(RateLimiterService.name);
  private stop?: () => void;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  onModuleInit(): void {
    this.stop = runEvery(cleanupEveryMs, 'rate limit cleanup', () => this.cleanup(), this.log);
  }

  onModuleDestroy(): void {
    this.stop?.();
  }

  private async hit({ key, limit, windowSeconds }: Limit): Promise<Verdict> {
    const now = this.clock.now().getTime();
    const windowMs = windowSeconds * 1000;
    const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
    const [row] = await this.prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" (key, "windowStart", count) VALUES (${key}, ${windowStart}, 1)
      ON CONFLICT (key, "windowStart") DO UPDATE SET count = "RateLimit".count + 1
      RETURNING count`;
    if (!row) {
      throw new Error(`counting ${key} returned no row`);
    }
    if (row.count <= limit) {
      return { kind: 'allowed' };
    }
    return {
      kind: 'limited',
      retryAfterSeconds: Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now) / 1000)),
    };
  }

  async admit(own: Limit[], shared: Limit[]): Promise<Verdict> {
    const verdict = await this.hitAll(own);
    return verdict.kind === 'allowed' ? this.hitAll(shared) : verdict;
  }

  private async hitAll(limits: Limit[]): Promise<Verdict> {
    const waits: number[] = [];
    for (const limit of limits) {
      const verdict = await this.hit(limit);
      if (verdict.kind === 'limited') {
        waits.push(verdict.retryAfterSeconds);
      }
    }
    return waits.length === 0
      ? { kind: 'allowed' }
      : { kind: 'limited', retryAfterSeconds: Math.max(...waits) };
  }

  private async cleanup(): Promise<void> {
    const cutoff = new Date(this.clock.now().getTime() - keepMs);
    await this.prisma.rateLimit.deleteMany({ where: { windowStart: { lt: cutoff } } });
  }
}
