import { Inject, Injectable } from '@nestjs/common';
import type { Content } from '@portfolio/content';
import type { Report } from '@portfolio/content/report';
import { z } from 'zod';
import { ClockService } from '../../common/clock.service.js';
import { CONTENT } from '../../content.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { firstRawDay } from '../retention.js';
import { dropReasons } from '../visit-log.service.js';
import { findVisits, firstUnrolledDay } from '../visit-rows.js';
import { buildReport, firstReportedDay } from './build-report.js';

const knownDropReason = z.enum(dropReasons);

@Injectable()
export class AnalyticsReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    @Inject(CONTENT) private readonly content: Content,
  ) {}

  async build(days: number): Promise<Report> {
    const now = this.clock.now();
    const firstPeriodDay = firstRawDay(now);
    const { rawFrom, visits, rolled, questions, dropped, applications, rolledApplications } =
      await this.prisma.$transaction(
        async (tx) => {
          const unrolledFrom = await firstUnrolledDay(tx, now);
          return {
            rawFrom: unrolledFrom,
            visits: await findVisits(tx, { startedAt: { gte: unrolledFrom } }),
            rolled: await tx.dailyVisits.findMany({
              where: { day: { gte: firstReportedDay(now, days) } },
            }),
            questions: await tx.askLog.findMany({
              where: { createdAt: { gte: firstPeriodDay } },
              select: { createdAt: true, refused: true },
            }),
            dropped: await tx.droppedEvents.findMany({ where: { day: { gte: firstPeriodDay } } }),
            applications: await tx.application.findMany({
              select: {
                id: true,
                code: true,
                company: true,
                role: true,
                appliedOn: true,
                country: true,
                city: true,
                atsHost: true,
                networks: true,
              },
            }),
            rolledApplications: await tx.dailyApplication.findMany({
              select: { day: true, applicationId: true, visits: true, views: true },
            }),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 },
      );
    return buildReport(
      {
        rawFrom,
        visits,
        rolled,
        questions,
        applications,
        rolledApplications,
        dropped: dropped.map(({ reason, ...row }) => ({
          ...row,
          reason: knownDropReason.parse(reason),
        })),
      },
      this.content,
      now,
      days,
    );
  }
}
