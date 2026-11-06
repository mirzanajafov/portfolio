import { Injectable } from '@nestjs/common';
import { AlertsService, type FirstView } from '../alerts/alerts.service.js';
import { bakuDay, dayOf, utcDay } from '../common/days.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { dataCenterOf, dataCenters } from './data-centers.js';
import type { AnalyticsEvent } from './event.schema.js';
import type { Place } from './place-lookup.js';
import type { Browser, Device } from './user-agent.js';

export const dropReasons = ['bot', 'limited', 'origin', 'own'] as const;

export type DropReason = (typeof dropReasons)[number];

type Visitor = Place & { key: string; device: Device; browser: Browser };

type EventOf<T extends AnalyticsEvent['type']> = Extract<AnalyticsEvent, { type: T }>;

type FollowUp = Exclude<AnalyticsEvent, { type: 'view' }>;

type UnseenApplication = { id: string; code: string; createdAt: Date };

@Injectable()
export class VisitLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
  ) {}

  async recordView(
    event: EventOf<'view'>,
    { key, ...visit }: Visitor,
    demo: string | null,
    at: Date,
  ): Promise<void> {
    const unseen =
      event.ref === undefined || dataCenterOf(visit) !== null
        ? null
        : await this.prisma.application.findFirst({
            where: { code: event.ref, firstSeenOn: null },
            select: { id: true, code: true, createdAt: true },
          });
    const write = async (db: Prisma.TransactionClient) => {
      await db.visit.createMany({
        data: [{ visitor: key, startedAt: at, ...visit }],
        skipDuplicates: true,
      });
      const { count } = await db.pageView.createMany({
        data: [
          {
            id: event.id,
            createdAt: at,
            visitor: key,
            path: event.path,
            notFound: event.notFound,
            referrerHost: event.referrer,
            ref: event.ref,
            demo,
          },
        ],
        skipDuplicates: true,
      });
      if (count > 0 && unseen) {
        const firstView = { path: event.path, demo, notFound: event.notFound };
        await this.noteFirstVisit(db, unseen, firstView, at);
      }
    };
    await (unseen ? this.prisma.$transaction(write) : write(this.prisma));
  }

  private async noteFirstVisit(
    tx: Prisma.TransactionClient,
    unseen: UnseenApplication,
    firstView: FirstView,
    at: Date,
  ): Promise<void> {
    const recordedBefore = await earliestDayRecordedBefore(tx, unseen, at);
    const [application] = await tx.application.updateManyAndReturn({
      where: { id: unseen.id, firstSeenOn: null },
      data: { firstSeenOn: recordedBefore ?? bakuDay(at) },
      select: { company: true, role: true },
    });
    if (application && !recordedBefore) {
      await this.alerts.queueFirstVisit(tx, application, firstView, at);
    }
  }

  async record(event: FollowUp, demo: string | null, at: Date): Promise<void> {
    switch (event.type) {
      case 'read':
        await this.prisma.pageView.updateMany({
          where: { id: event.view, demo, readSeq: { lt: event.seq } },
          data: {
            readSeq: event.seq,
            activeSeconds: event.activeSeconds,
            maxScroll: event.maxScroll,
            blocks: event.blocks,
          },
        });
        return;
      case 'action':
        await this.prisma.pageView.updateMany({
          where: { id: event.view, demo, NOT: { actions: { has: event.name } } },
          data: { actions: { push: event.name } },
        });
        return;
      case 'click':
        await ignoringUnknownView(
          this.prisma.linkClick.create({
            data: { createdAt: at, href: event.href, view: { connect: { id: event.view, demo } } },
          }),
        );
        return;
      case 'vital':
        await this.recordVital(event, demo);
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
              view: { connect: { id: event.view, demo } },
            },
          }),
        );
    }
  }

  async countDropped(reason: DropReason, at: Date): Promise<void> {
    const day = dayOf(at);
    await this.prisma.$executeRaw`
      INSERT INTO "DroppedEvents" (day, reason) VALUES (${day}::date, ${reason})
      ON CONFLICT (day, reason) DO UPDATE SET count = "DroppedEvents".count + 1`;
  }

  private async recordVital({ view, name, value }: EventOf<'vital'>, demo: string | null) {
    switch (name) {
      case 'LCP': {
        const lcpMs = Math.round(value);
        await this.prisma.pageView.updateMany({
          where: { id: view, demo, OR: [{ lcpMs: null }, { lcpMs: { lt: lcpMs } }] },
          data: { lcpMs },
        });
        return;
      }
      case 'INP': {
        const inpMs = Math.round(value);
        await this.prisma.pageView.updateMany({
          where: { id: view, demo, OR: [{ inpMs: null }, { inpMs: { lt: inpMs } }] },
          data: { inpMs },
        });
        return;
      }
      case 'CLS':
        await this.prisma.pageView.updateMany({
          where: { id: view, demo, OR: [{ cls: null }, { cls: { lt: value } }] },
          data: { cls: value },
        });
    }
  }
}

async function earliestDayRecordedBefore(
  tx: Prisma.TransactionClient,
  { id, code, createdAt }: UnseenApplication,
  at: Date,
): Promise<Date | null> {
  const view = await tx.pageView.findFirst({
    where: {
      ref: code,
      createdAt: { gte: createdAt, lt: at },
      visit: { OR: [{ network: null }, { network: { notIn: dataCenters } }] },
    },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  const rolled = await tx.dailyApplication.findFirst({
    where: { applicationId: id, day: { gte: utcDay(createdAt) } },
    orderBy: { day: 'asc' },
    select: { day: true },
  });
  const viewDay = view ? bakuDay(view.createdAt) : null;
  const rolledDay = rolled?.day ?? null;
  if (viewDay === null || rolledDay === null) {
    return viewDay ?? rolledDay;
  }
  return viewDay < rolledDay ? viewDay : rolledDay;
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
