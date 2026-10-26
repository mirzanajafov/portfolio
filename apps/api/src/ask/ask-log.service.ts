import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Clock } from '../common/clock.service.js';
import { runEvery } from '../common/run-every.js';
import { ENV, type Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AskOutcome } from './ask.service.js';

const cleanupEveryMs = 60 * 60 * 1000;
const dayMs = 24 * 60 * 60 * 1000;

type AskLogEntry = AskOutcome & { client: string; question: string; durationMs: number };

@Injectable()
export class AskLogService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(AskLogService.name);
  private stop?: () => void;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    this.stop = runEvery(cleanupEveryMs, 'ask log cleanup', () => this.cleanup(), this.log);
  }

  onModuleDestroy(): void {
    this.stop?.();
  }

  async record(entry: AskLogEntry): Promise<void> {
    try {
      await this.prisma.askLog.create({ data: { ...entry, createdAt: this.clock.now() } });
    } catch (error) {
      this.log.warn(
        `could not log a question: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async cleanup(): Promise<void> {
    const cutoff = new Date(this.clock.now().getTime() - this.env.ASK_LOG_DAYS * dayMs);
    await this.prisma.askLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  }
}
