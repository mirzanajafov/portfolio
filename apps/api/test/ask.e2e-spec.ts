import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { AskLogService } from '../src/ask/ask-log.service.js';
import { Clock } from '../src/common/clock.js';
import { ENV, parseEnv } from '../src/config/env.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

class FixedClock extends Clock {
  current = new Date('2026-10-02T12:00:00Z');
  override now(): Date {
    return this.current;
  }
}

type Event = { event: string; data: { type: string; sources?: { id: string; href?: string }[] } };

function parseEvents(body: string): Event[] {
  return body
    .split('\n\n')
    .filter(Boolean)
    .map((block) => ({
      event: /^event: (.*)$/m.exec(block)?.[1] ?? '',
      data: JSON.parse(/^data: (.*)$/m.exec(block)?.[1] ?? 'null') as Event['data'],
    }));
}

async function startApp(overrides: Record<string, string> = {}) {
  const clock = new FixedClock();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ENV)
    .useValue(parseEnv({ ...process.env, ...overrides }))
    .overrideProvider(Clock)
    .useValue(clock)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return { app, clock, prisma: app.get(PrismaService) };
}

async function loggedRows(prisma: PrismaService, question: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const rows = await prisma.askLog.findMany({ where: { question } });
    if (rows.length > 0) {
      return rows;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return [];
}

const ask = (app: NestExpressApplication, question: string, ip = '203.0.113.7') =>
  request(app.getHttpServer()).post('/ask').set('X-Forwarded-For', ip).send({ question });

describe('POST /ask against a real database', () => {
  let app: NestExpressApplication;
  let clock: FixedClock;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, clock, prisma } = await startApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE "RateLimit", "AskLog"`;
  });

  it('streams an answer as server-sent events, with the source of every sentence', async () => {
    const response = await ask(app, 'How does Matchium decide which questions to ask each user?')
      .expect(200)
      .expect('Content-Type', /text\/event-stream/);
    const events = parseEvents(response.text);
    expect(events[0]?.data).toEqual({ type: 'meta', engine: 'keyword' });
    expect(events.at(-1)?.data).toEqual({ type: 'done' });
    const first = events.find((e) => e.event === 'sentence')?.data;
    const source = first?.sources?.[0];
    expect(source?.id.startsWith('matchium/')).toBe(true);
    const href = source?.href ?? '';
    expect(
      href.startsWith('https://github.com/mirzanajafov/matchium/') || href === '/projects/matchium',
    ).toBe(true);
  });

  it('never links into a private repo', async () => {
    const response = await ask(app, 'How does cancelling a request work in TM Post?').expect(200);
    const sentence = parseEvents(response.text).find((e) => e.event === 'sentence')?.data;
    expect(sentence?.sources?.[0]?.id).toBe('tm-post/cancel-latency');
    expect(sentence?.sources?.[0]?.href).toBeUndefined();
  });

  const invalid: [object, string][] = [
    [{}, 'no question'],
    [{ question: '   ' }, 'a blank question'],
    [{ question: 'x'.repeat(301) }, 'a question over 300 characters'],
    [{ question: 'hi', extra: true }, 'unexpected fields'],
  ];

  it.each(invalid)('rejects %j (%s) before counting it', async (body) => {
    await request(app.getHttpServer()).post('/ask').send(body).expect(400);
    expect(await prisma.rateLimit.count()).toBe(0);
  });

  it('logs the question with a hashed caller and the sources it cited, never the address', async () => {
    await ask(app, 'Have you worked with Stripe payments?').expect(200);
    const rows = await loggedRows(prisma, 'Have you worked with Stripe payments?');
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row?.question).toBe('Have you worked with Stripe payments?');
    expect(row?.engine).toBe('keyword');
    expect(row?.refused).toBe(false);
    expect(row?.client).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(row)).not.toContain('203.0.113.7');
    expect(row?.sentences).toEqual([
      expect.objectContaining({ sources: [expect.stringMatching(/^cv\/neurotime-ai/)] }),
    ]);
  });

  it('marks a question it could not answer as refused', async () => {
    await ask(app, 'What is your favourite colour?').expect(200);
    const [row] = await loggedRows(prisma, 'What is your favourite colour?');
    expect(row?.refused).toBe(true);
  });

  it('limits each caller separately and says when to come back', async () => {
    for (let i = 0; i < 3; i += 1) {
      await ask(app, 'Have you worked with Stripe payments?', '198.51.100.1').expect(200);
    }
    const limited = await ask(app, 'Have you worked with Stripe payments?', '198.51.100.1').expect(
      429,
    );
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    await ask(app, 'Have you worked with Stripe payments?', '198.51.100.2').expect(200);
  });

  it('lets a caller back in when the window moves on', async () => {
    for (let i = 0; i < 3; i += 1) {
      await ask(app, 'Stripe?', '198.51.100.3').expect(200);
    }
    await ask(app, 'Stripe?', '198.51.100.3').expect(429);
    clock.current = new Date(clock.current.getTime() + 10 * 60 * 1000);
    await ask(app, 'Stripe?', '198.51.100.3').expect(200);
  });

  it('deletes questions older than the retention window and keeps the rest', async () => {
    const base = { client: 'x', engine: 'keyword', sentences: [], withheld: [], refused: true };
    await prisma.askLog.createMany({
      data: [
        { ...base, question: 'old', durationMs: 1, createdAt: new Date('2026-08-01T00:00:00Z') },
        { ...base, question: 'new', durationMs: 1, createdAt: new Date('2026-09-30T00:00:00Z') },
      ],
    });
    await app.get(AskLogService).cleanup();
    const left = await prisma.askLog.findMany({ where: { question: { in: ['old', 'new'] } } });
    expect(left.map((row) => row.question)).toEqual(['new']);
  });
});

describe('POST /ask behind a proxy it does not trust', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await startApp({ TRUST_PROXY: 'false' }));
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await prisma.$executeRaw`TRUNCATE "RateLimit", "AskLog"`;
  });

  it('ignores X-Forwarded-For, so a caller cannot dodge the limit by making up addresses', async () => {
    for (let i = 0; i < 3; i += 1) {
      await ask(app, 'Stripe?', `192.0.2.${i}`).expect(200);
    }
    await ask(app, 'Stripe?', '192.0.2.99').expect(429);
  });
});
