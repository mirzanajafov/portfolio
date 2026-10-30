import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RetentionService } from '../src/analytics/retention.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { sendEvent } from './send-event.js';
import { FixedClock, startApp } from './start-app.js';

describe('retention against a real database', () => {
  let app: NestExpressApplication;
  let clock: FixedClock;
  let prisma: PrismaService;

  const send = (event: object, ip?: string) => sendEvent(app, event, { ip }).expect(204);

  const at = (time: string) => {
    clock.current = new Date(time);
  };

  const cleanup = () => app.get(RetentionService).cleanup();

  const daysRolled = async () =>
    (await prisma.dailyVisits.findMany({ orderBy: { day: 'asc' } })).map(({ day, visits }) => [
      day.toISOString().slice(0, 10),
      visits,
    ]);

  beforeAll(async () => {
    ({ app, clock, prisma } = await startApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE "RateLimit", "Visit", "PageView", "LinkClick", "ClientError", "DroppedEvents", "DailyVisits", "DailyPage", "DailySource", "DailyCountry", "DailyClick", "DailyApplication", "Application" CASCADE`;
  });

  it('keeps a day raw until it is 30 full days old, then rolls it up and deletes its visits with their page views, clicks and errors', async () => {
    const old = randomUUID();
    at('2026-10-02T12:00:00Z');
    await send({ type: 'view', id: old, path: '/' });
    await send({ type: 'click', view: old, href: '/cv.pdf' });
    await send({ type: 'error', view: old, message: 'x', source: '/a.js' });
    at('2026-10-03T12:00:00Z');
    await send({ type: 'view', id: randomUUID(), path: '/cv' }, '198.51.100.4');

    at('2026-11-01T23:59:59Z');
    await cleanup();
    expect(await prisma.visit.count()).toBe(2);
    expect(await daysRolled()).toEqual([]);

    at('2026-11-02T00:00:00Z');
    await cleanup();
    expect((await prisma.pageView.findMany()).map(({ path }) => path)).toEqual(['/cv']);
    expect(await prisma.linkClick.count()).toBe(0);
    expect(await prisma.clientError.count()).toBe(0);
    expect(await daysRolled()).toEqual([['2026-10-02', 1]]);
  });

  it('leaves a day raw when its rollup fails partway', async () => {
    at('2026-10-02T12:00:00Z');
    await send({ type: 'view', id: randomUUID(), path: '/' });
    await prisma.dailyPage.create({
      data: {
        day: new Date('2026-10-02'),
        path: '/',
        device: 'desktop',
        views: 0,
        visits: 0,
        exits: 0,
        notFoundViews: 0,
        activeSeconds: [],
        maxScroll: [],
        blockSeconds: {},
        lcpMs: [],
        inpMs: [],
        cls: [],
      },
    });

    at('2026-11-02T00:00:00Z');
    await expect(cleanup()).rejects.toThrow();

    expect(await prisma.visit.count()).toBe(1);
    expect(await daysRolled()).toEqual([]);
  });

  it("keeps a rolled day's numbers, and no visitor in them", async () => {
    const view = randomUUID();
    at('2026-10-02T12:00:00Z');
    await send({ type: 'view', id: view, path: '/projects/tuner', referrer: 'www.google.com' });
    await send({
      type: 'read',
      view,
      seq: 1,
      activeSeconds: 40,
      maxScroll: 80,
      blocks: { problem: 5 },
    });
    await send({ type: 'vital', view, name: 'LCP', value: 1800 });
    await send({ type: 'click', view, href: '/cv.pdf' });
    const [visitor] = (await prisma.visit.findMany()).map(({ visitor }) => visitor);

    at('2026-11-02T00:00:00Z');
    await cleanup();

    const daily = {
      visits: await prisma.dailyVisits.findMany(),
      pages: await prisma.dailyPage.findMany(),
      sources: await prisma.dailySource.findMany(),
      countries: await prisma.dailyCountry.findMany(),
      clicks: await prisma.dailyClick.findMany(),
    };
    expect(daily.visits).toMatchObject([{ visits: 1, pageViews: 1, visitSeconds: [40] }]);
    expect(daily.pages).toMatchObject([
      {
        path: '/projects/tuner',
        device: 'desktop',
        views: 1,
        exits: 1,
        activeSeconds: [40],
        maxScroll: [80],
        blockSeconds: { problem: [5] },
        lcpMs: [1800],
      },
    ]);
    expect(daily.sources).toMatchObject([{ source: 'google', host: 'www.google.com', visits: 1 }]);
    expect(daily.countries).toMatchObject([{ country: 'AZ', visits: 1 }]);
    expect(daily.clicks).toMatchObject([{ path: '/projects/tuner', href: '/cv.pdf', clicks: 1 }]);
    expect(JSON.stringify(daily)).not.toContain(visitor);
  });

  it('rolls up every day in between, a day without visits as zeros, and no day twice', async () => {
    at('2026-10-02T12:00:00Z');
    await send({ type: 'view', id: randomUUID(), path: '/' });
    at('2026-10-04T12:00:00Z');
    await send({ type: 'view', id: randomUUID(), path: '/' });

    at('2026-11-04T01:00:00Z');
    await cleanup();
    await cleanup();

    expect(await daysRolled()).toEqual([
      ['2026-10-02', 1],
      ['2026-10-03', 0],
      ['2026-10-04', 1],
    ]);
    expect(await prisma.visit.count()).toBe(0);
  });

  it("keeps an application's daily visits as long as the application, and no unregistered code", async () => {
    const memh = await prisma.application.create({
      data: {
        code: 'memh',
        company: 'Xsolla',
        role: 'Developer',
        appliedOn: new Date('2026-09-30'),
      },
    });
    at('2026-10-02T12:00:00Z');
    await send({ type: 'view', id: randomUUID(), path: '/', ref: 'memh' });
    await send({ type: 'view', id: randomUUID(), path: '/cv' });
    await send({ type: 'view', id: randomUUID(), path: '/', ref: 'kxqtz' }, '198.51.100.4');

    at('2026-11-02T00:00:00Z');
    await cleanup();
    expect(await prisma.dailyApplication.findMany()).toMatchObject([
      { applicationId: memh.id, visits: 1, views: 2 },
    ]);

    await prisma.application.delete({ where: { id: memh.id } });
    expect(await prisma.dailyApplication.count()).toBe(0);
  });

  it("deletes daily totals and dropped counters after 25 months, but keeps an application's", async () => {
    const memh = await prisma.application.create({
      data: {
        code: 'memh',
        company: 'Xsolla',
        role: 'Developer',
        appliedOn: new Date('2024-08-30'),
      },
    });
    const oldDay = new Date('2024-09-01');
    const keptDay = new Date('2026-09-01');
    const totals = { visits: 1, pageViews: 1, phoneVisits: 0, quickExits: 0, visitSeconds: [30] };
    await prisma.dailyVisits.createMany({
      data: [
        { day: oldDay, ...totals },
        { day: keptDay, ...totals },
      ],
    });
    await prisma.dailySource.create({
      data: { day: oldDay, source: 'direct', host: '', visits: 1 },
    });
    await prisma.droppedEvents.create({ data: { day: oldDay, reason: 'bot', count: 3 } });
    await prisma.dailyApplication.create({
      data: { day: oldDay, applicationId: memh.id, visits: 1, views: 1 },
    });

    at('2026-10-02T12:00:00Z');
    await cleanup();

    expect(await daysRolled()).toEqual([['2026-09-01', 1]]);
    expect(await prisma.dailySource.count()).toBe(0);
    expect(await prisma.droppedEvents.count()).toBe(0);
    expect(await prisma.dailyApplication.count()).toBe(1);
  });
});
