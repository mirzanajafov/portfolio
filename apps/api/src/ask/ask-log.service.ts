import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Clock } from '../common/clock.js';
import { ENV, type Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';

const cleanupEveryMs = 60 * 60 * 1000;
const dayMs = 24 * 60 * 60 * 1000;

export type AskLogEntry = {
  client: string;
  question: string;
  engine: string;
  sentences: { text: string; sources: string[] }[];
  withheld: string[];
  durationMs: number;
};

@Injectable()
export class AskLogService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(AskLogService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.cleanup(), cleanupEveryMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async record(entry: AskLogEntry): Promise<void> {
    try {
      await this.prisma.askLog.create({
        data: {
          ...entry,
          refused: entry.sentences.every((sentence) => sentence.sources.length === 0),
          createdAt: this.clock.now(),
        },
      });
    } catch (error) {
      this.log.warn(`could not log a question: ${(error as Error).message}`);
    }
  }

  async cleanup(): Promise<number> {
    const cutoff = new Date(this.clock.now().getTime() - this.env.ASK_LOG_DAYS * dayMs);
    try {
      const { count } = await this.prisma.askLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      return count;
    } catch (error) {
      this.log.warn(`ask log cleanup failed: ${(error as Error).message}`);
      return 0;
    }
  }
}
