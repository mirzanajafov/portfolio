import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { askLogDays } from '@portfolio/content/ask';
import { VisitorSaltService } from '../analytics/visitor-salt.service.js';
import type { Caller } from '../common/caller.js';
import { ClockService } from '../common/clock.service.js';
import { runEvery } from '../common/run-every.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AskOutcome } from './ask.service.js';

const cleanupEveryMs = 60 * 60 * 1000;
const dayMs = 24 * 60 * 60 * 1000;

type AskLogEntry = AskOutcome & { caller: Caller; question: string; durationMs: number };

@Injectable()
export class AskLogService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(AskLogService.name);
  private stop?: () => void;

  constructor(
    private readonly prisma: PrismaService,
    private readonly salts: VisitorSaltService,
    private readonly clock: ClockService,
  ) {}

  onModuleInit(): void {
    this.stop = runEvery(cleanupEveryMs, 'ask log cleanup', () => this.cleanup(), this.log);
  }

  onModuleDestroy(): void {
    this.stop?.();
  }

  async record({ caller: { ip, userAgent, optedOut }, ...entry }: AskLogEntry): Promise<void> {
    const createdAt = this.clock.now();
    try {
      const visitor =
        optedOut || !userAgent ? null : await this.salts.visitorKey(ip, userAgent, createdAt);
      await this.prisma.askLog.create({ data: { ...entry, visitor, createdAt } });
    } catch (error) {
      this.log.warn(
        `could not log a question: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async cleanup(): Promise<void> {
    const cutoff = new Date(this.clock.now().getTime() - askLogDays * dayMs);
    await this.prisma.askLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  }
}
