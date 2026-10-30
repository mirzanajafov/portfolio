import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ClockService } from '../common/clock.service.js';
import { runEvery } from '../common/run-every.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { daysAfter } from './days.js';
import { firstDailyDay, firstRawDay } from './retention.js';
import { rollUp } from './roll-up.js';
import { findVisits, firstUnrolledDay } from './visit-rows.js';

const cleanupEveryMs = 60 * 60 * 1000;

@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(RetentionService.name);
  private stop?: () => void;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  onModuleInit(): void {
    this.stop = runEvery(cleanupEveryMs, 'retention', () => this.cleanup(), this.log);
  }

  onModuleDestroy(): void {
    this.stop?.();
  }

  async cleanup(): Promise<void> {
    const now = this.clock.now();
    const rawFrom = firstRawDay(now);
    for (
      let day = await firstUnrolledDay(this.prisma, now);
      day < rawFrom;
      day = daysAfter(day, 1)
    ) {
      await this.rollUpDay(day);
    }
    await this.deleteTotalsBefore(firstDailyDay(now));
  }

  private async rollUpDay(day: Date): Promise<void> {
    const during = { startedAt: { gte: day, lt: daysAfter(day, 1) } };
    await this.prisma.$transaction(async (tx) => {
      const { totals, pages, sources, countries, clicks, applications } = rollUp(
        await findVisits(tx, during),
      );
      const registered = await tx.application.findMany({
        where: { code: { in: applications.map(({ code }) => code) } },
        select: { id: true, code: true },
      });
      const idOf = new Map(registered.map(({ code, id }) => [code, id]));
      await tx.dailyVisits.create({ data: { day, ...totals } });
      await tx.dailyPage.createMany({ data: pages.map((page) => ({ day, ...page })) });
      await tx.dailySource.createMany({ data: sources.map((source) => ({ day, ...source })) });
      await tx.dailyCountry.createMany({
        data: countries.map((country) => ({ day, ...country })),
      });
      await tx.dailyClick.createMany({ data: clicks.map((click) => ({ day, ...click })) });
      await tx.dailyApplication.createMany({
        data: applications.flatMap(({ code, visits, views }) => {
          const applicationId = idOf.get(code);
          return applicationId ? [{ day, applicationId, visits, views }] : [];
        }),
      });
      await tx.visit.deleteMany({ where: during });
    });
  }

  private async deleteTotalsBefore(day: Date): Promise<void> {
    const old = { where: { day: { lt: day } } };
    await this.prisma.$transaction([
      this.prisma.dailyVisits.deleteMany(old),
      this.prisma.dailyPage.deleteMany(old),
      this.prisma.dailySource.deleteMany(old),
      this.prisma.dailyCountry.deleteMany(old),
      this.prisma.dailyClick.deleteMany(old),
      this.prisma.droppedEvents.deleteMany(old),
    ]);
  }
}
