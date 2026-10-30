import { Inject, Injectable } from '@nestjs/common';
import type { Content } from '@portfolio/content';
import { z } from 'zod';
import { ClockService } from '../../common/clock.service.js';
import { CONTENT } from '../../content.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { keptSince } from '../retention.js';
import { browsers, devices } from '../user-agent.js';
import { dropReasons } from '../visit-log.service.js';
import { buildReport } from './build-report.js';
import type { Report } from './report.js';

const blockSeconds = z.record(z.string(), z.number());
const knownDevice = z.enum(devices);
const knownBrowser = z.enum(browsers);
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
    const kept = keptSince(now);
    const [visits, questions, dropped] = await Promise.all([
      this.prisma.visit.findMany({
        where: { startedAt: { gte: kept } },
        select: {
          startedAt: true,
          device: true,
          browser: true,
          country: true,
          views: {
            select: {
              createdAt: true,
              path: true,
              notFound: true,
              referrerHost: true,
              ref: true,
              activeSeconds: true,
              maxScroll: true,
              blocks: true,
              lcpMs: true,
              inpMs: true,
              cls: true,
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
        kept,
        visits: visits.map(({ views, device, browser, ...visit }) => ({
          ...visit,
          device: knownDevice.parse(device),
          browser: knownBrowser.parse(browser),
          views: views.map(({ blocks, ...view }) => ({
            ...view,
            blocks: blockSeconds.parse(blocks),
          })),
        })),
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
