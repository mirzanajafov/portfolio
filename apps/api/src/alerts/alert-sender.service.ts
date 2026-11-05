import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { alertHours } from '@portfolio/content/analytics';
import { dayOf } from '../common/days.js';
import { ClockService } from '../common/clock.service.js';
import { runEvery } from '../common/run-every.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TELEGRAM, sendMessage, type Telegram } from './telegram.js';

const sendEveryMs = 10_000;
const giveUpEveryMs = 60 * 60 * 1000;
const leaseMs = 60_000;
const firstRetrySeconds = 60;
const longestRetrySeconds = 60 * 60;

type DueAlert = { id: string; text: string; attempts: number };

export function retryDelaySeconds(attempts: number): number {
  return Math.min(firstRetrySeconds * 2 ** (attempts - 1), longestRetrySeconds);
}

function oldestSendable(now: Date): Date {
  return new Date(now.getTime() - alertHours * 60 * 60 * 1000);
}

@Injectable()
export class AlertSenderService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(AlertSenderService.name);
  private readonly stops: (() => void)[] = [];
  private pass: { done: Promise<void>; abort: AbortController } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    @Inject(TELEGRAM) private readonly telegram: Telegram | null,
  ) {}

  onModuleInit(): void {
    this.stops.push(
      runEvery(giveUpEveryMs, 'giving up old alerts', () => this.giveUpOld(), this.log),
    );
    if (this.telegram) {
      this.stops.push(
        runEvery(
          sendEveryMs,
          'sending alerts',
          () => (this.pass ? Promise.resolve() : this.sendDue()),
          this.log,
        ),
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const stop of this.stops) {
      stop();
    }
    this.pass?.abort.abort();
    await Promise.allSettled([this.pass?.done]);
  }

  sendDue(): Promise<void> {
    if (!this.pass) {
      const abort = new AbortController();
      const done = this.sendUntilNoneDue(abort.signal).finally(() => {
        this.pass = null;
      });
      this.pass = { done, abort };
    }
    return this.pass.done;
  }

  async giveUpOld(): Promise<void> {
    const now = this.clock.now();
    const givenUp = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.alert.deleteMany({
        where: { createdAt: { lt: oldestSendable(now) }, nextAttemptAt: { lte: now } },
      });
      if (count > 0) {
        await tx.$executeRaw`
          INSERT INTO "GivenUpAlerts" (day, count) VALUES (${dayOf(now)}::date, ${count})
          ON CONFLICT (day) DO UPDATE SET count = "GivenUpAlerts".count + ${count}`;
      }
      return count;
    });
    if (givenUp > 0) {
      this.log.warn(`gave up ${String(givenUp)} alerts not sent within ${String(alertHours)} h`);
    }
  }

  private async sendUntilNoneDue(stopped: AbortSignal): Promise<void> {
    const { telegram } = this;
    if (!telegram) {
      return;
    }
    let goOn = true;
    while (goOn && !stopped.aborted) {
      goOn = await this.sendNext(telegram);
    }
  }

  private async sendNext(telegram: Telegram): Promise<boolean> {
    const now = this.clock.now();
    const [alert] = await this.prisma.$queryRaw<DueAlert[]>`
      UPDATE "Alert" SET "nextAttemptAt" = ${new Date(now.getTime() + leaseMs)}
      WHERE id = (
        SELECT id FROM "Alert"
        WHERE "nextAttemptAt" <= ${now} AND "createdAt" >= ${oldestSendable(now)}
        ORDER BY "nextAttemptAt"
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, text, attempts`;
    if (!alert) {
      return false;
    }
    const delivery = await sendMessage(telegram, alert.text);
    if (delivery.kind === 'sent') {
      await this.prisma.alert.deleteMany({ where: { id: alert.id } });
      return true;
    }
    const failedAt = this.clock.now().getTime();
    const { retryAfterSeconds } = delivery;
    if (retryAfterSeconds !== null) {
      const heldUntil = new Date(failedAt + retryAfterSeconds * 1000);
      await this.prisma.alert.updateMany({
        where: { OR: [{ id: alert.id }, { nextAttemptAt: { lt: heldUntil } }] },
        data: { nextAttemptAt: heldUntil },
      });
      this.log.warn(
        `alert not sent (${delivery.reason}), holding every waiting alert for ${String(retryAfterSeconds)} s`,
      );
      return false;
    }
    const attempts = alert.attempts + 1;
    const delaySeconds = retryDelaySeconds(attempts);
    await this.prisma.alert.updateMany({
      where: { id: alert.id },
      data: { attempts, nextAttemptAt: new Date(failedAt + delaySeconds * 1000) },
    });
    this.log.warn(`alert not sent (${delivery.reason}), next try in ${String(delaySeconds)} s`);
    return false;
  }
}
