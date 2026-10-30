import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ClockService } from '../common/clock.service.js';
import { runEvery } from '../common/run-every.js';
import { PrismaService } from '../prisma/prisma.service.js';

const cleanupEveryMs = 60 * 60 * 1000;

@Injectable()
export class VisitorSaltService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(VisitorSaltService.name);
  private stop?: () => void;
  private current?: { day: string; salt: Uint8Array };

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  onModuleInit(): void {
    this.stop = runEvery(cleanupEveryMs, 'visitor salt cleanup', () => this.cleanup(), this.log);
  }

  onModuleDestroy(): void {
    this.stop?.();
  }

  async today(): Promise<Uint8Array> {
    const day = this.clock.now().toISOString().slice(0, 10);
    if (this.current?.day === day) {
      return this.current.salt;
    }
    const [row] = await this.prisma.$queryRaw<{ salt: Uint8Array }[]>`
      INSERT INTO "VisitorSalt" (day, salt) VALUES (${day}::date, ${randomBytes(32)})
      ON CONFLICT (day) DO UPDATE SET day = EXCLUDED.day
      RETURNING salt`;
    if (!row) {
      throw new Error(`storing the salt for ${day} returned no row`);
    }
    this.current = { day, salt: row.salt };
    return row.salt;
  }

  async cleanup(): Promise<void> {
    const day = this.clock.now().toISOString().slice(0, 10);
    if (this.current?.day !== day) {
      this.current = undefined;
    }
    await this.prisma.$executeRaw`DELETE FROM "VisitorSalt" WHERE day < ${day}::date`;
  }
}
