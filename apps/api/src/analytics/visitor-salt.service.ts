import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ClockService } from '../common/clock.service.js';
import { runEvery } from '../common/run-every.js';
import { ENV, type Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { dayOf } from './days.js';
import { dailyKey, keyed, networkOf } from './visitor-key.js';

const cleanupEveryMs = 60 * 60 * 1000;

export type DayKeys = {
  limit: (ip: string) => string;
  visitor: (ip: string, userAgent: string) => string;
};

@Injectable()
export class VisitorSaltService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(VisitorSaltService.name);
  private stop?: () => void;
  private current?: { day: string; key: Uint8Array };

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    this.stop = runEvery(cleanupEveryMs, 'visitor salt cleanup', () => this.cleanup(), this.log);
  }

  onModuleDestroy(): void {
    this.stop?.();
  }

  async dayKeys(now: Date): Promise<DayKeys> {
    const key = await this.keyFor(now);
    return {
      limit: (ip) => keyed(key, 'limit', networkOf(ip)),
      visitor: (ip, userAgent) => keyed(key, networkOf(ip), userAgent),
    };
  }

  private async keyFor(now: Date): Promise<Uint8Array> {
    const day = dayOf(now);
    if (this.current?.day === day) {
      return this.current.key;
    }
    const [row] = await this.prisma.$queryRaw<{ salt: Uint8Array }[]>`
      INSERT INTO "VisitorSalt" (day, salt) VALUES (${day}::date, ${randomBytes(32)})
      ON CONFLICT (day) DO UPDATE SET day = EXCLUDED.day
      RETURNING salt`;
    if (!row) {
      throw new Error(`storing the salt for ${day} returned no row`);
    }
    const key = dailyKey(this.env.CLIENT_HASH_SECRET, row.salt);
    this.current = { day, key };
    await this.deleteBefore(day);
    return key;
  }

  async cleanup(): Promise<void> {
    const day = dayOf(this.clock.now());
    if (this.current?.day !== day) {
      this.current = undefined;
    }
    await this.deleteBefore(day);
  }

  private async deleteBefore(day: string): Promise<void> {
    await this.prisma.$executeRaw`DELETE FROM "VisitorSalt" WHERE day < ${day}::date`;
  }
}
