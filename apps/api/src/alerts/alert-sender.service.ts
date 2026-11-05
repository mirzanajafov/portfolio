import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { alertHours } from '@portfolio/content/analytics';
import { dayOf } from '../analytics/days.js';
import { ClockService } from '../common/clock.service.js';
import { runEvery } from '../common/run-every.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TELEGRAM, sendMessage, sendTimeoutMs, type Telegram } from './telegram.js';

const sendEveryMs = 10_000;
const firstRetrySeconds = 60;
const longestRetrySeconds = 60 * 60;

type DueAlert = { id: string; text: string; attempts: number; createdAt: Date };

export function retryDelaySeconds(attempts: number, retryAfterSeconds: number | null): number {
  return (
    retryAfterSeconds ?? Math.min(firstRetrySeconds * 2 ** (attempts - 1), longestRetrySeconds)
  );
}

@Injectable()
export class AlertSenderService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(AlertSenderService.name);
  private stop?: () => void;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    @Inject(TELEGRAM) private readonly telegram: Telegram | null,
  ) {}

  onModuleInit(): void {
    if (this.telegram) {
      this.stop = runEvery(sendEveryMs, 'sending alerts', () => this.sendDue(), this.log);
    }
  }

  onModuleDestroy(): void {
    this.stop?.();
  }

  async sendDue(): Promise<void> {
    const { telegram } = this;
    if (!telegram) {
      return;
    }
    let goOn = true;
    while (goOn) {
      goOn = await this.sendNext(telegram);
    }
  }

  private sendNext(telegram: Telegram): Promise<boolean> {
    return this.prisma.$transaction(
      async (tx) => {
        const now = this.clock.now();
        const [alert] = await tx.$queryRaw<DueAlert[]>`
          SELECT id, text, attempts, "createdAt" FROM "Alert"
          WHERE "nextAttemptAt" <= ${now}
          ORDER BY "nextAttemptAt"
          LIMIT 1
          FOR UPDATE SKIP LOCKED`;
        if (!alert) {
          return false;
        }
        if (now.getTime() - alert.createdAt.getTime() > alertHours * 60 * 60 * 1000) {
          await tx.alert.delete({ where: { id: alert.id } });
          await tx.$executeRaw`
            INSERT INTO "GivenUpAlerts" (day) VALUES (${dayOf(now)}::date)
            ON CONFLICT (day) DO UPDATE SET count = "GivenUpAlerts".count + 1`;
          this.log.warn(`gave up an alert not sent within ${String(alertHours)} h`);
          return true;
        }
        const delivery = await sendMessage(telegram, alert.text);
        if (delivery.kind === 'sent') {
          await tx.alert.delete({ where: { id: alert.id } });
          return true;
        }
        const attempts = alert.attempts + 1;
        const delaySeconds = retryDelaySeconds(attempts, delivery.retryAfterSeconds);
        await tx.alert.update({
          where: { id: alert.id },
          data: { attempts, nextAttemptAt: new Date(now.getTime() + delaySeconds * 1000) },
        });
        this.log.warn(
          `alert not sent (${delivery.reason}), attempt ${String(attempts)}, next in ${String(delaySeconds)} s`,
        );
        return false;
      },
      { timeout: sendTimeoutMs + 5_000 },
    );
  }
}
