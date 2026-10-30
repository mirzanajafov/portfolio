import { z } from 'zod';
import type { Prisma } from '../generated/prisma/client.js';
import { daysAfter, utcDay } from './days.js';
import { firstRawDay } from './retention.js';
import { browsers, devices } from './user-agent.js';
import type { VisitRow } from './visits.js';

const blockSeconds = z.record(z.string(), z.number());
const knownDevice = z.enum(devices);
const knownBrowser = z.enum(browsers);

export async function findVisits(
  db: Prisma.TransactionClient,
  where: Prisma.VisitWhereInput,
): Promise<VisitRow[]> {
  const visits = await db.visit.findMany({
    where,
    select: {
      visitor: true,
      startedAt: true,
      device: true,
      browser: true,
      country: true,
      city: true,
      network: true,
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
  });
  return visits.map(({ views, device, browser, ...visit }) => ({
    ...visit,
    device: knownDevice.parse(device),
    browser: knownBrowser.parse(browser),
    views: views.map(({ blocks, ...view }) => ({ ...view, blocks: blockSeconds.parse(blocks) })),
  }));
}

export async function firstUnrolledDay(db: Prisma.TransactionClient, now: Date): Promise<Date> {
  const newest = await db.dailyVisits.findFirst({
    orderBy: { day: 'desc' },
    select: { day: true },
  });
  if (newest) {
    return daysAfter(newest.day, 1);
  }
  const oldest = await db.visit.findFirst({
    orderBy: { startedAt: 'asc' },
    select: { startedAt: true },
  });
  const rawFrom = firstRawDay(now);
  return oldest && oldest.startedAt < rawFrom ? utcDay(oldest.startedAt) : rawFrom;
}
