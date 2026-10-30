import { Inject, Injectable } from '@nestjs/common';
import type { Content } from '@portfolio/content';
import { analyticsDays } from '@portfolio/content/analytics';
import { z } from 'zod';
import { ClockService } from '../../common/clock.service.js';
import { CONTENT } from '../../content.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { buildReport } from './build-report.js';
import type { Report } from './report.js';

const dayMs = 24 * 60 * 60 * 1000;
const blockSeconds = z.record(z.string(), z.number());

@Injectable()
export class AnalyticsReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    @Inject(CONTENT) private readonly content: Content,
  ) {}

  async build(days: number): Promise<Report> {
    const now = this.clock.now();
    const kept = new Date(now.getTime() - analyticsDays * dayMs);
    const [visits, questions, dropped] = await Promise.all([
      this.prisma.visit.findMany({
        where: { startedAt: { gte: kept } },
        include: {
          views: {
            include: {
              clicks: { select: { href: true } },
              errors: { select: { message: true, source: true } },
            },
          },
        },
      }),
      this.prisma.askLog.findMany({
        where: { createdAt: { gte: kept } },
        select: { createdAt: true, refused: true },
      }),
      this.prisma.droppedEvents.findMany({ where: { day: { gte: kept } } }),
    ]);
    return buildReport(
      {
        visits: visits.map(({ views, ...visit }) => ({
          ...visit,
          views: views.map(({ blocks, ...view }) => ({
            ...view,
            blocks: blockSeconds.parse(blocks),
          })),
        })),
        questions,
        dropped,
      },
      this.content,
      now,
      days,
    );
  }
}
