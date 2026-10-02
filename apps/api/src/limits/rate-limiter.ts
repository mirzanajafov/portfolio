import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Clock } from '../common/clock.js';
import { PrismaService } from '../prisma/prisma.service.js';

const cleanupEveryMs = 60 * 60 * 1000;
const keepMs = 2 * 24 * 60 * 60 * 1000;

export type Verdict = { allowed: boolean; retryAfterSeconds: number };

export type Limit = { key: string; limit: number; windowSeconds: number };

@Injectable()
export class RateLimiter implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(RateLimiter.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.cleanup(), cleanupEveryMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async hit({ key, limit, windowSeconds }: Limit): Promise<Verdict> {
    const now = this.clock.now().getTime();
    const windowMs = windowSeconds * 1000;
    const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
    const [row] = await this.prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" (key, "windowStart", count) VALUES (${key}, ${windowStart}, 1)
      ON CONFLICT (key, "windowStart") DO UPDATE SET count = "RateLimit".count + 1
      RETURNING count`;
    const count = row?.count ?? 1;
    return {
      allowed: count <= limit,
      retryAfterSeconds: Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now) / 1000)),
    };
  }

  async hitAll(limits: Limit[]): Promise<Verdict> {
    let retryAfterSeconds = 0;
    for (const limit of limits) {
      const verdict = await this.hit(limit);
      if (!verdict.allowed) {
        retryAfterSeconds = Math.max(retryAfterSeconds, verdict.retryAfterSeconds);
      }
    }
    return { allowed: retryAfterSeconds === 0, retryAfterSeconds };
  }

  async cleanup(): Promise<number> {
    const cutoff = new Date(this.clock.now().getTime() - keepMs);
    try {
      const { count } = await this.prisma.rateLimit.deleteMany({
        where: { windowStart: { lt: cutoff } },
      });
      return count;
    } catch (error) {
      this.log.warn(`rate limit cleanup failed: ${(error as Error).message}`);
      return 0;
    }
  }
}
