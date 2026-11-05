import type { NestExpressApplication } from '@nestjs/platform-express';
import { createServer } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AlertSenderService } from '../src/alerts/alert-sender.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
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
  path: '/bottest-token/sendMessage',
  body: { chat_id: '42', text },
});

const firstCv =
  'Xsolla, Backend Engineer: someone opened your link, first /cv, at 2026-10-02 16:00 Baku time.';

async function startOverWithXsolla(prisma: PrismaService): Promise<void> {
  await prisma.$executeRaw`TRUNCATE "RateLimit", "Visit", "PageView", "Application", "Alert", "GivenUpAlerts" CASCADE`;
  await prisma.application.create({
    data: {
      code: 'memh',
      company: 'Xsolla',
      role: 'Backend Engineer',
      appliedOn: new Date('2026-10-01'),
    },
  });
}

const firstSeen = (prisma: PrismaService) =>
  prisma.application.findUnique({ where: { code: 'memh' }, select: { firstSeenAt: true } });

describe('first-visit alerts against a real database and a fake Bot API', () => {
  const bot = fakeBotApi();
  let app: NestExpressApplication;
  let clock: FixedClock;
  let prisma: PrismaService;

  const sendDue = () => app.get(AlertSenderService).sendDue();

  const at = (time: string) => {
    clock.current = new Date(time);
  };

  beforeAll(async () => {
    const url = await listenLocally(bot.server);
    ({ app, clock, prisma } = await startApp({
      TELEGRAM_API_URL: url,
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: '42',
    }));
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
    expect(await firstSeen(prisma)).toEqual({ firstSeenAt: new Date('2026-10-02T12:00:00Z') });
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

  it('sends nothing for a code nobody registered or a browser that opted out', async () => {
    await sendEvent(app, aCodedView({ ref: 'zzzz' })).expect(204);
    await sendEvent(app, aCodedView(), { headers: { 'Sec-GPC': '1' } }).expect(204);
    await sendDue();

    expect(bot.received).toEqual([]);
    expect(await firstSeen(prisma)).toEqual({ firstSeenAt: null });
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

  it('waits as long as Telegram asks when it is rate limited', async () => {
    bot.replies.push({ status: 429, body: { ok: false, parameters: { retry_after: 7 } } });
    await sendEvent(app, aCodedView()).expect(204);
    await sendDue();

    expect(await prisma.alert.findFirst()).toMatchObject({
      attempts: 1,
      nextAttemptAt: new Date('2026-10-02T12:00:07Z'),
    });
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
    expect(await prisma.alert.count()).toBe(0);
    expect(await prisma.givenUpAlerts.findMany()).toEqual([
      { day: new Date('2026-10-03'), count: 1 },
    ]);
  });
});

describe('first visits while alerts are off', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await startApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('still notes the first visit but writes no alert, so turning alerts on later sends no old ones', async () => {
    await startOverWithXsolla(prisma);
    await sendEvent(app, aCodedView()).expect(204);

    expect(await firstSeen(prisma)).toEqual({ firstSeenAt: new Date('2026-10-02T12:00:00Z') });
    expect(await prisma.alert.count()).toBe(0);
  });
});
