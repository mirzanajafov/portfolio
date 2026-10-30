import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFinished } from 'vitest';
import { dailyKey, keyed } from '../src/analytics/visitor-key.js';
import { VisitorSaltService } from '../src/analytics/visitor-salt.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { fixtureContent } from './content.fixture.js';
import { FixedClock, startApp } from './start-app.js';

const chrome =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const headlessChrome =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36';
const address = '203.0.113.7';

type Sender = { ip?: string; userAgent?: string | null; headers?: Record<string, string> };

function send(
  app: NestExpressApplication,
  event: object,
  { ip = address, userAgent = chrome, headers = {} }: Sender = {},
) {
  const call = request(app.getHttpServer()).post('/events').set('X-Forwarded-For', ip);
  if (userAgent === null) {
    call.unset('User-Agent');
  } else {
    call.set('User-Agent', userAgent);
  }
  return call.set(headers).send(event);
}

const aView = (overrides: Record<string, unknown> = {}) => ({
  type: 'view',
  id: randomUUID(),
  path: '/',
  ...overrides,
});

describe('POST /events against a real database', () => {
  let app: NestExpressApplication;
  let clock: FixedClock;
  let prisma: PrismaService;

  const everything = async () => ({
    visits: await prisma.visit.findMany(),
    views: await prisma.pageView.findMany({ orderBy: { createdAt: 'asc' } }),
    clicks: await prisma.linkClick.findMany(),
    errors: await prisma.clientError.findMany(),
    dropped: await prisma.droppedEvents.findMany(),
    limits: await prisma.rateLimit.findMany(),
  });

  beforeAll(async () => {
    ({ app, clock, prisma } = await startApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    clock.current = new Date('2026-10-02T12:00:00Z');
    await prisma.$executeRaw`TRUNCATE "RateLimit", "Visit", "PageView", "LinkClick", "ClientError", "DroppedEvents"`;
  });

  it('records a landing with its code and the next pages under one visitor', async () => {
    await send(app, aView({ ref: 'memh', referrer: 'www.linkedin.com' })).expect(204);
    clock.current = new Date('2026-10-02T12:01:00Z');
    await send(app, aView({ path: '/projects/tuner' })).expect(204);

    const { visits, views } = await everything();
    expect(visits).toEqual([
      expect.objectContaining({
        device: 'desktop',
        browser: 'chrome',
        startedAt: new Date('2026-10-02T12:00:00Z'),
      }),
    ]);
    expect(
      views.map(({ visitor, path, ref, referrerHost }) => ({ visitor, path, ref, referrerHost })),
    ).toEqual([
      { visitor: visits[0]?.visitor, path: '/', ref: 'memh', referrerHost: 'www.linkedin.com' },
      { visitor: visits[0]?.visitor, path: '/projects/tuner', ref: null, referrerHost: null },
    ]);
  });

  it('counts a page view sent twice once', async () => {
    const view = aView();
    await send(app, view).expect(204);
    await send(app, view).expect(204);
    expect((await everything()).views).toHaveLength(1);
  });

  it('keeps the same visitor after the API restarts the same day', async () => {
    clock.current = new Date('2026-10-12T09:00:00Z');
    await send(app, aView()).expect(204);

    const restarted = await startApp();
    onTestFinished(() => restarted.app.close());
    restarted.clock.current = new Date('2026-10-12T15:00:00Z');
    await send(restarted.app, aView()).expect(204);

    const { visits, views } = await everything();
    expect(visits).toHaveLength(1);
    expect(views).toHaveLength(2);
  });

  it('gives the same browser a new visitor the next day and drops the old salt at once', async () => {
    clock.current = new Date('2026-10-20T23:59:00Z');
    await send(app, aView()).expect(204);
    clock.current = new Date('2026-10-21T00:01:00Z');
    await send(app, aView()).expect(204);

    const { visits } = await everything();
    expect(visits).toHaveLength(2);
    const salts = await prisma.visitorSalt.findMany();
    const days = salts.map(({ day }) => day.toISOString().slice(0, 10));
    expect(days).toContain('2026-10-21');
    expect(days).not.toContain('2026-10-20');

    const yesterday = visits.find(({ startedAt }) => startedAt.getUTCDate() === 20)?.visitor;
    const secret = process.env.CLIENT_HASH_SECRET ?? '';
    const rebuilt = salts.map(({ salt }) => keyed(dailyKey(secret, salt), address, chrome));
    expect(rebuilt).not.toContain(yesterday);
  });

  it('needs the secret from the environment as well as the salt to rebuild a visitor', async () => {
    clock.current = new Date('2026-10-22T10:00:00Z');
    await send(app, aView()).expect(204);

    const [visit] = (await everything()).visits;
    const { salt } = await prisma.visitorSalt.findUniqueOrThrow({
      where: { day: new Date('2026-10-22') },
    });
    const secret = process.env.CLIENT_HASH_SECRET ?? '';
    expect(keyed(salt, address, chrome)).not.toBe(visit?.visitor);
    expect(keyed(dailyKey(secret, salt), address, chrome)).toBe(visit?.visitor);
  });

  it('deletes the old salt within the hour even when nobody visits the next day', async () => {
    clock.current = new Date('2026-10-24T22:00:00Z');
    await send(app, aView()).expect(204);
    clock.current = new Date('2026-10-25T00:30:00Z');
    await app.get(VisitorSaltService).cleanup();

    const days = (await prisma.visitorSalt.findMany()).map(({ day }) => day.toISOString());
    expect(days).not.toContain('2026-10-24T00:00:00.000Z');
  });

  it('stores the address in no column of any table', async () => {
    const view = aView({ ref: 'memh' });
    await send(app, view).expect(204);
    await send(app, { type: 'click', view: view.id, href: '/cv.pdf' }).expect(204);
    await send(app, { type: 'vital', view: view.id, name: 'LCP', value: 1800 }).expect(204);

    const stored = JSON.stringify(await everything());
    expect(stored).not.toContain(address);
    expect(stored).not.toContain('Windows NT');
  });

  it.each([
    ['Sec-GPC', '1'],
    ['DNT', '1'],
  ])('records nothing at all for a browser that sends %s', async (header, value) => {
    await send(app, aView(), { headers: { [header]: value } }).expect(204);
    expect(await everything()).toEqual({
      visits: [],
      views: [],
      clicks: [],
      errors: [],
      dropped: [],
      limits: [],
    });
  });

  it('drops bots and requests without a user agent, and only counts them', async () => {
    await send(app, aView(), { userAgent: headlessChrome }).expect(204);
    await send(app, aView(), { userAgent: null }).expect(204);
    await send(app, aView(), { userAgent: '' }).expect(204);

    const { visits, views, dropped } = await everything();
    expect(visits).toEqual([]);
    expect(views).toEqual([]);
    expect(dropped).toEqual([expect.objectContaining({ reason: 'bot', count: 3 })]);
  });

  it('limits each address, counts what it refuses, and leaves other addresses alone', async () => {
    for (let sent = 0; sent < 8; sent += 1) {
      await send(app, aView()).expect(204);
    }
    const refused = await send(app, aView()).expect(429);
    expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
    await send(app, aView(), { ip: '198.51.100.4' }).expect(204);

    const { views, dropped, limits } = await everything();
    expect(views).toHaveLength(9);
    expect(dropped).toEqual([expect.objectContaining({ reason: 'limited', count: 1 })]);
    expect(limits.find(({ key }) => key === 'events:day:everyone')?.count).toBe(9);
  });

  it('keeps the fullest reading and ignores one that arrives late', async () => {
    const view = aView();
    await send(app, view).expect(204);
    const read = { type: 'read', view: view.id, maxScroll: 60 };
    await send(app, { ...read, seq: 2, activeSeconds: 40, blocks: { problem: 6, demo: 3 } }).expect(
      204,
    );
    await send(app, { ...read, seq: 1, activeSeconds: 10, blocks: { problem: 6 } }).expect(204);

    expect((await everything()).views).toEqual([
      expect.objectContaining({
        readSeq: 2,
        activeSeconds: 40,
        maxScroll: 60,
        blocks: { problem: 6, demo: 3 },
      }),
    ]);
  });

  it('records clicks on the links the site shows, and only on page views it saw', async () => {
    const view = aView();
    await send(app, view).expect(204);
    const href = fixtureContent.profile.links.github;
    await send(app, { type: 'click', view: view.id, href }).expect(204);
    await send(app, { type: 'click', view: randomUUID(), href }).expect(204);
    await send(app, { type: 'click', view: view.id, href: 'https://elsewhere.example' }).expect(
      400,
    );

    expect((await everything()).clicks).toEqual([
      expect.objectContaining({ viewId: view.id, href, createdAt: clock.current }),
    ]);
  });

  it('keeps the largest value of each Web Vital', async () => {
    const view = aView();
    await send(app, view).expect(204);
    for (const [name, value] of [
      ['LCP', 2000.4],
      ['LCP', 1500],
      ['INP', 120],
      ['INP', 310],
      ['CLS', 0.12],
      ['CLS', 0.05],
    ] as const) {
      await send(app, { type: 'vital', view: view.id, name, value }).expect(204);
    }

    expect((await everything()).views).toEqual([
      expect.objectContaining({ lcpMs: 2000, inpMs: 310, cls: 0.12 }),
    ]);
  });

  it('records script errors on page views it saw', async () => {
    const view = aView();
    await send(app, view).expect(204);
    const error = { type: 'error', message: 'x is undefined', source: '/_next/static/a.js' };
    await send(app, { ...error, view: view.id, line: 3, column: 14 }).expect(204);
    await send(app, { ...error, view: randomUUID() }).expect(204);

    expect((await everything()).errors).toEqual([
      expect.objectContaining({ viewId: view.id, message: 'x is undefined', line: 3, column: 14 }),
    ]);
  });
});
