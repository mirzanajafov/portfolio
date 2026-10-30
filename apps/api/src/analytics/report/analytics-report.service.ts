import { Inject, Injectable } from '@nestjs/common';
import type { Content } from '@portfolio/content';
import { z } from 'zod';
import { ClockService } from '../../common/clock.service.js';
import { CONTENT } from '../../content.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { firstRawDay } from '../retention.js';
import { dropReasons } from '../visit-log.service.js';
import { findVisits } from '../visit-rows.js';
import { buildReport } from './build-report.js';
import type { Report } from './report.js';

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
    const kept = firstRawDay(now);
    const [visits, questions, dropped] = await Promise.all([
      findVisits(this.prisma, { startedAt: { gte: kept } }),
      this.prisma.askLog.findMany({
        where: { createdAt: { gte: kept } },
        select: { createdAt: true, refused: true },
      }),
      this.prisma.droppedEvents.findMany({ where: { day: { gte: kept } } }),
    ]);
    return buildReport(
      {
        kept,
        visits,
        questions,
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
