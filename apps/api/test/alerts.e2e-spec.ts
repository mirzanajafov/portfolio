import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AlertSenderService } from '../src/alerts/alert-sender.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { anApplication } from './applications.js';
import { listenLocally } from './local-server.js';
import { aView, sendEvent } from './send-event.js';
import { FixedClock, startApp } from './start-app.js';

type Reply = { status: number; body: object };

const delivered: Reply = { status: 200, body: { ok: true, result: {} } };

function fakeBotApi() {
  const received: { path: string; body: unknown }[] = [];
  const replies: Reply[] = [];
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on('end', () => {
      received.push({ path: request.url ?? '', body: JSON.parse(body) });
      const { status, body: reply } = replies.shift() ?? delivered;
      response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(reply));
    });
  });
  return { server, received, replies };
}

const aCodedView = (overrides: Record<string, unknown> = {}) =>
  aView({ path: '/cv', ref: 'memh', ...overrides });

const message = (text: string) => ({
  path: '/bot123:test-token/sendMessage',
  body: { chat_id: '42', text },
});

const firstCv =
  'Xsolla, Backend Engineer: someone opened your link, first the CV, at 2026-10-02 16:00 Baku time.';

const register = (prisma: PrismaService, code: string, company: string) =>
  prisma.application.create({
    data: {
      ...anApplication(),
      code,
      company,
      role: 'Backend Engineer',
      appliedOn: new Date('2026-10-01'),
      createdAt: new Date('2026-10-01T00:00:00Z'),
    },
  });

async function startOverWithXsolla(prisma: PrismaService): Promise<void> {
  await prisma.$executeRaw`TRUNCATE "RateLimit", "Visit", "PageView", "Application", "Alert", "GivenUpAlerts" CASCADE`;
  await register(prisma, 'memh', 'Xsolla');
}

const firstSeen = (prisma: PrismaService) =>
  prisma.application.findUnique({ where: { code: 'memh' }, select: { firstSeenOn: true } });

describe('first-visit alerts against a real database and a fake Bot API', () => {
  const bot = fakeBotApi();
  let app: NestExpressApplication;
  let clock: FixedClock;
  let prisma: PrismaService;

  const sender = () => app.get(AlertSenderService);

  const sendDue = () => sender().sendDue();

  const at = (time: string) => {
    clock.current = new Date(time);
  };

  beforeAll(async () => {
    const url = await listenLocally(bot.server);
    ({ app, clock, prisma } = await startApp({
      TELEGRAM_API_URL: url,
      TELEGRAM_BOT_TOKEN: '123:test-token',
      TELEGRAM_CHAT_ID: '42',
    }));
    await sender().onModuleDestroy();
  });

  afterAll(async () => {
    await app.close();
    await new Promise((resolve) => bot.server.close(resolve));
  });

  beforeEach(async () => {
    at('2026-10-02T12:00:00Z');
    bot.received.length = 0;
    bot.replies.length = 0;
    await startOverWithXsolla(prisma);
  });

  it('sends one message for the first coded view, with the application, the first page and the time, and none for the next', async () => {
    await sendEvent(app, aCodedView()).expect(204);
    at('2026-10-02T12:05:00Z');
    await sendEvent(app, aCodedView({ path: '/' })).expect(204);
    await sendDue();

    expect(bot.received).toEqual([message(firstCv)]);
    expect(await prisma.alert.count()).toBe(0);
    expect(await firstSeen(prisma)).toEqual({ firstSeenOn: new Date('2026-10-02') });
  });

  it('sends one message when two first views arrive at once', async () => {
    await Promise.all([
      sendEvent(app, aCodedView()).expect(204),
      sendEvent(app, aCodedView(), { ip: '198.51.100.4' }).expect(204),
    ]);
    await sendDue();

    expect(bot.received).toEqual([message(firstCv)]);
  });

  it('names the demo when the first coded view is one of its pages', async () => {
    await sendEvent(app, aCodedView({ path: '/today' }), {
      headers: { Origin: 'https://tuner.najafov.dev' },
    }).expect(204);
    await sendDue();

    expect(bot.received).toEqual([
      message(
        'Xsolla, Backend Engineer: someone opened your link, first the Tuner demo, at 2026-10-02 16:00 Baku time.',
      ),
    ]);
  });

  it.each([
    ['a path the site never had', { path: '/evil.example/login', notFound: true }],
    ['a known path that showed the missing page', { path: '/cv', notFound: true }],
  ])(
    'names the first page by the site, never by the path the visitor sent: %s',
    async (_, view) => {
      await sendEvent(app, aCodedView(view)).expect(204);
      await sendDue();

      expect(bot.received).toEqual([
        message(
          "Xsolla, Backend Engineer: someone opened your link, first a page that isn't on the site, at 2026-10-02 16:00 Baku time.",
        ),
      ]);
    },
  );

  it('sends no message when older code recorded an earlier coded view since registration, and notes that day', async () => {
    const recorded = (createdAt: string) => ({
      id: randomUUID(),
      createdAt: new Date(createdAt),
      path: '/',
      ref: 'memh',
    });
    await prisma.visit.create({
      data: {
        visitor: 'older',
        startedAt: new Date('2026-09-30T10:00:00Z'),
        device: 'desktop',
        browser: 'chrome',
        views: {
          create: [recorded('2026-09-30T10:00:00Z'), recorded('2026-10-01T10:00:00Z')],
        },
      },
    });
    await sendEvent(app, aCodedView()).expect(204);
    await sendDue();

    expect(bot.received).toEqual([]);
    expect(await firstSeen(prisma)).toEqual({ firstSeenOn: new Date('2026-10-01') });
  });

  it('sends no message when older code rolled up an earlier day of the application, and notes that day', async () => {
    const xsolla = await prisma.application.findUniqueOrThrow({ where: { code: 'memh' } });
    await prisma.dailyApplication.create({
      data: { day: new Date('2026-10-01'), applicationId: xsolla.id, visits: 1, views: 1 },
    });
    await sendEvent(app, aCodedView()).expect(204);
    await sendDue();

    expect(bot.received).toEqual([]);
    expect(await firstSeen(prisma)).toEqual({ firstSeenOn: new Date('2026-10-01') });
  });

  it('sends nothing for a code nobody registered or a browser that opted out', async () => {
    await sendEvent(app, aCodedView({ ref: 'zzzz' })).expect(204);
    await sendEvent(app, aCodedView(), { headers: { 'Sec-GPC': '1' } }).expect(204);
    await sendDue();

    expect(bot.received).toEqual([]);
    expect(await firstSeen(prisma)).toEqual({ firstSeenOn: null });
  });

  it('runs one pass at a time, so a failure ends it before a second pass tries the next alert', async () => {
    await register(prisma, 'k7mpx', 'Wolt');
    bot.replies.push({ status: 500, body: { ok: false } });
    await sendEvent(app, aCodedView()).expect(204);
    await sendEvent(app, aCodedView({ ref: 'k7mpx' }), { ip: '198.51.100.4' }).expect(204);
    await Promise.all([sendDue(), sendDue()]);

    expect(bot.received).toHaveLength(1);
  });

  it('tries again a minute after a failure and sends the message once', async () => {
    bot.replies.push({ status: 500, body: { ok: false } });
    await sendEvent(app, aCodedView()).expect(204);
    await sendDue();
    at('2026-10-02T12:00:59Z');
    await sendDue();
    expect(bot.received).toHaveLength(1);

    at('2026-10-02T12:01:00Z');
    await sendDue();
    expect(bot.received).toEqual([message(firstCv), message(firstCv)]);
    expect(await prisma.alert.count()).toBe(0);
  });

  it('holds an alert at most a day, however long a rate limit asks for', async () => {
    bot.replies.push({ status: 429, body: { ok: false, parameters: { retry_after: 1e13 } } });
    await sendEvent(app, aCodedView()).expect(204);
    await sendDue();

    expect(await prisma.alert.findFirst()).toMatchObject({
      nextAttemptAt: new Date('2026-10-03T12:00:00Z'),
    });
  });

  it('backs off as usual when a rate limit asks for no wait at all', async () => {
    bot.replies.push({ status: 429, body: { ok: false, parameters: { retry_after: 0 } } });
    await sendEvent(app, aCodedView()).expect(204);
    await sendDue();

    expect(await prisma.alert.findFirst()).toMatchObject({
      attempts: 1,
      nextAttemptAt: new Date('2026-10-02T12:01:00Z'),
    });
  });

  it('takes a wait Telegram gives in a fraction of a second as a rate limit too', async () => {
    bot.replies.push({ status: 429, body: { ok: false, parameters: { retry_after: 1.5 } } });
    await sendEvent(app, aCodedView()).expect(204);
    await sendDue();

    expect(await prisma.alert.findFirst()).toMatchObject({
      attempts: 0,
      nextAttemptAt: new Date('2026-10-02T12:00:01.500Z'),
    });
  });

  it('holds every waiting alert as long as Telegram asks when it is rate limited', async () => {
    await register(prisma, 'k7mpx', 'Wolt');
    bot.replies.push({ status: 429, body: { ok: false, parameters: { retry_after: 7 } } });
    await sendEvent(app, aCodedView()).expect(204);
    await sendEvent(app, aCodedView({ ref: 'k7mpx' }), { ip: '198.51.100.4' }).expect(204);
    await sendDue();
    at('2026-10-02T12:00:06Z');
    await sendDue();
    expect(bot.received).toHaveLength(1);
    expect(
      (await prisma.alert.findMany()).map(({ attempts, nextAttemptAt }) => [
        attempts,
        nextAttemptAt.toISOString(),
      ]),
    ).toEqual([
      [0, '2026-10-02T12:00:07.000Z'],
      [0, '2026-10-02T12:00:07.000Z'],
    ]);

    at('2026-10-02T12:00:07Z');
    await sendDue();
    expect(bot.received).toHaveLength(3);
    expect(await prisma.alert.count()).toBe(0);
  });

  it('keeps an alert Telegram refuses, then gives it up unsent after a day and counts it', async () => {
    const refused = { status: 401, body: { ok: false, description: 'Unauthorized' } };
    bot.replies.push(refused, refused, refused);
    await sendEvent(app, aCodedView()).expect(204);
    for (const time of ['2026-10-02T12:00:00Z', '2026-10-02T12:01:00Z', '2026-10-03T12:00:00Z']) {
      at(time);
      await sendDue();
    }
    expect(bot.received).toHaveLength(3);
    expect(await prisma.alert.findFirst()).toMatchObject({ attempts: 3 });

    at('2026-10-03T12:04:00Z');
    await sendDue();
    expect(bot.received).toHaveLength(3);
    await sender().giveUpOld();
    expect(await prisma.alert.count()).toBe(0);
    expect(await prisma.givenUpAlerts.findMany()).toEqual([
      { day: new Date('2026-10-03'), count: 1 },
    ]);
  });
});

describe('first visits while alerts are off', () => {
  let app: NestExpressApplication;
  let clock: FixedClock;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, clock, prisma } = await startApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    clock.current = new Date('2026-10-02T12:00:00Z');
  });

  it('gives up an alert left from when alerts were on or held past its day, but not one a send has claimed', async () => {
    await startOverWithXsolla(prisma);
    const old = (nextAttemptAt: string) => ({
      text: 'Xsolla, Backend Engineer: someone opened your link',
      createdAt: new Date('2026-10-01T11:59:59Z'),
      nextAttemptAt: new Date(nextAttemptAt),
    });
    await prisma.alert.create({ data: old('2026-10-01T12:00:00Z') });
    await prisma.alert.create({ data: old('2026-10-03T11:00:00Z') });
    const claimed = await prisma.alert.create({ data: old('2026-10-02T12:00:30Z') });
    await app.get(AlertSenderService).giveUpOld();

    expect((await prisma.alert.findMany()).map(({ id }) => id)).toEqual([claimed.id]);
    expect(await prisma.givenUpAlerts.findMany()).toEqual([
      { day: new Date('2026-10-02'), count: 2 },
    ]);
  });

  it('notes the first visit on its day in Baku, the calendar applications are counted in', async () => {
    await startOverWithXsolla(prisma);
    clock.current = new Date('2026-10-02T22:30:00Z');
    await sendEvent(app, aCodedView()).expect(204);

    expect(await firstSeen(prisma)).toEqual({ firstSeenOn: new Date('2026-10-03') });
  });

  it('still notes the first visit but writes no alert, so turning alerts on later sends no old ones', async () => {
    await startOverWithXsolla(prisma);
    await sendEvent(app, aCodedView()).expect(204);

    expect(await firstSeen(prisma)).toEqual({ firstSeenOn: new Date('2026-10-02') });
    expect(await prisma.alert.count()).toBe(0);
  });
});
