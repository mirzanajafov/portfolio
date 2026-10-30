import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AnalyticsEvent } from './event.schema.js';
import { browserOf, deviceOf } from './user-agent.js';

type DropReason = 'bot' | 'limited';

type Visitor = { key: string; userAgent: string };

type EventOf<T extends AnalyticsEvent['type']> = Extract<AnalyticsEvent, { type: T }>;

@Injectable()
export class VisitLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(event: AnalyticsEvent, visitor: Visitor, at: Date): Promise<void> {
    switch (event.type) {
      case 'view':
        await this.recordView(event, visitor, at);
        return;
      case 'read':
        await this.prisma.pageView.updateMany({
          where: { id: event.view, readSeq: { lt: event.seq } },
          data: {
            readSeq: event.seq,
            activeSeconds: event.activeSeconds,
            maxScroll: event.maxScroll,
            blocks: event.blocks,
          },
        });
        return;
      case 'click':
        await ignoringUnknownView(
          this.prisma.linkClick.create({
            data: { createdAt: at, href: event.href, view: { connect: { id: event.view } } },
          }),
        );
        return;
      case 'vital':
        await this.recordVital(event);
        return;
      case 'error':
        await ignoringUnknownView(
          this.prisma.clientError.create({
            data: {
              createdAt: at,
              message: event.message,
              source: event.source,
              line: event.line,
              column: event.column,
              view: { connect: { id: event.view } },
            },
          }),
        );
    }
  }

  async countDropped(reason: DropReason, at: Date): Promise<void> {
    const day = at.toISOString().slice(0, 10);
    await this.prisma.$executeRaw`
      INSERT INTO "DroppedEvents" (day, reason) VALUES (${day}::date, ${reason})
      ON CONFLICT (day, reason) DO UPDATE SET count = "DroppedEvents".count + 1`;
  }

  private async recordView(event: EventOf<'view'>, { key, userAgent }: Visitor, at: Date) {
    await this.prisma.visit.createMany({
      data: [
        { visitor: key, startedAt: at, device: deviceOf(userAgent), browser: browserOf(userAgent) },
      ],
      skipDuplicates: true,
    });
    await this.prisma.pageView.createMany({
      data: [
        {
          id: event.id,
          createdAt: at,
          visitor: key,
          path: event.path,
          notFound: event.notFound,
          referrerHost: event.referrer,
          ref: event.ref,
        },
      ],
      skipDuplicates: true,
    });
  }

  private async recordVital({ view, name, value }: EventOf<'vital'>) {
    switch (name) {
      case 'LCP': {
        const lcpMs = Math.round(value);
        await this.prisma.pageView.updateMany({
          where: { id: view, OR: [{ lcpMs: null }, { lcpMs: { lt: lcpMs } }] },
          data: { lcpMs },
        });
        return;
      }
      case 'INP': {
        const inpMs = Math.round(value);
        await this.prisma.pageView.updateMany({
          where: { id: view, OR: [{ inpMs: null }, { inpMs: { lt: inpMs } }] },
          data: { inpMs },
        });
        return;
      }
      case 'CLS':
        await this.prisma.pageView.updateMany({
          where: { id: view, OR: [{ cls: null }, { cls: { lt: value } }] },
          data: { cls: value },
        });
    }
  }
}

async function ignoringUnknownView(write: Promise<unknown>): Promise<void> {
  try {
    await write;
  } catch (error) {
    const missingView =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
    if (!missingView) {
      throw error;
    }
  }
}
