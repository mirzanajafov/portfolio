import type { NestExpressApplication } from '@nestjs/platform-express';
import { askEventSchema, questionMaxLength, type AskEvent } from '@portfolio/content/ask';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AnswerEngine } from '../src/ask/answer-engine.js';
import { AskLogService } from '../src/ask/ask-log.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { chrome, sendEvent } from './send-event.js';
import { FixedClock, startApp } from './start-app.js';

type Event = { event: string; data: AskEvent };

function parseEvents(body: string): Event[] {
  return body
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const sent: unknown = JSON.parse(/^data: (.*)$/m.exec(block)?.[1] ?? 'null');
      const data = askEventSchema.parse(sent);
      expect(data).toStrictEqual(sent);
      return { event: /^event: (.*)$/m.exec(block)?.[1] ?? '', data };
    });
}

function sentencesOf(events: Event[]) {
  return events.flatMap(({ data }) => (data.type === 'sentence' ? [data] : []));
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

const ask = (
  app: NestExpressApplication,
  question: string,
  ip = '203.0.113.7',
  headers: Record<string, string> = { 'User-Agent': chrome },
) =>
  request(app.getHttpServer())
    .post('/ask')
    .set('X-Forwarded-For', ip)
    .set(headers)
    .send({ question });

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
    clock.current = new Date('2026-10-02T12:00:00Z');
    await prisma.$executeRaw`TRUNCATE "RateLimit", "AskLog", "Visit" CASCADE`;
  });

  it('streams an answer as server-sent events, with the source of every sentence', async () => {
    const response = await ask(app, 'How does Tuner decide which questions to ask each user?')
      .expect(200)
      .expect('Content-Type', /text\/event-stream/);
    const events = parseEvents(response.text);
    expect(events[0]?.data).toEqual({ type: 'meta', engine: 'keyword' });
    expect(events.at(-1)?.data).toEqual({ type: 'done' });
    const [first] = sentencesOf(events);
    const source = first?.sources[0];
    expect(source?.id.startsWith('tuner/')).toBe(true);
    const href = source?.href ?? '';
    expect(href.startsWith('https://github.com/someone/tuner/') || href === '/projects/tuner').toBe(
      true,
    );
  });

  it('never links into a private repo', async () => {
    const response = await ask(app, 'How does cancelling a request work in Courier?').expect(200);
    const [sentence] = sentencesOf(parseEvents(response.text));
    expect(sentence?.sources[0]?.id).toBe('courier/cancel-latency');
    expect(sentence?.sources[0]?.href).toBeUndefined();
  });

  const invalid: [object, string][] = [
    [{}, 'no question'],
    [{ question: '   ' }, 'a blank question'],
    [{ question: 'x'.repeat(questionMaxLength + 1) }, 'a question over the length limit'],
    [{ question: 'hi', extra: true }, 'unexpected fields'],
  ];

  it.each(invalid)('rejects %j (%s) before counting it', async (body) => {
    await request(app.getHttpServer()).post('/ask').send(body).expect(400);
    expect(await prisma.rateLimit.count()).toBe(0);
  });

  it('logs the question with its visit key and the sources it cited, never the address or the browser', async () => {
    await ask(app, 'Have you worked with Stripe payments?').expect(200);
    const rows = await loggedRows(prisma, 'Have you worked with Stripe payments?');
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row?.question).toBe('Have you worked with Stripe payments?');
    expect(row?.engine).toBe('keyword');
    expect(row?.refused).toBe(false);
    expect(row?.visitor).toMatch(/^[0-9a-f]{32}$/);
    expect(Object.keys(row ?? {}).toSorted()).toEqual([
      'createdAt',
      'durationMs',
      'engine',
      'id',
      'question',
      'refused',
      'sentences',
      'visitor',
      'withheld',
    ]);
    expect(JSON.stringify(row)).not.toContain('203.0.113.7');
    expect(JSON.stringify(row)).not.toContain('Windows NT');
    expect(row?.sentences).toEqual([
      expect.objectContaining({ sources: ['cv/northwind-2024-01/1'] }),
    ]);
  });

  it('ties a question to the visit the same browser made that day, and not to a visit after midnight', async () => {
    await sendEvent(app, { type: 'view', id: randomUUID(), path: '/' }).expect(204);
    await ask(app, 'Have you worked with Stripe payments?').expect(200);
    const [row] = await loggedRows(prisma, 'Have you worked with Stripe payments?');
    const visits = await prisma.visit.findMany();
    expect(visits).toHaveLength(1);
    expect(row?.visitor).toMatch(/^[0-9a-f]{32}$/);
    expect(row?.visitor).toBe(visits[0]?.visitor);

    clock.current = new Date('2026-10-03T00:00:01Z');
    await ask(app, 'What did you build with Kafka?').expect(200);
    const [next] = await loggedRows(prisma, 'What did you build with Kafka?');
    expect(next?.visitor).toMatch(/^[0-9a-f]{32}$/);
    expect(next?.visitor).not.toBe(row?.visitor);
  });

  it.each([
    ['Global Privacy Control', { 'User-Agent': chrome, 'Sec-GPC': '1' }],
    ['Do Not Track', { 'User-Agent': chrome, DNT: '1' }],
    ['no User-Agent', {}],
    ['the User-Agent of a bot', { 'User-Agent': 'node' }],
  ])('keeps a question asked with %s but ties it to no visit', async (_, headers) => {
    await ask(app, 'Have you worked with Stripe payments?', '203.0.113.7', headers).expect(200);
    const [row] = await loggedRows(prisma, 'Have you worked with Stripe payments?');
    expect(row?.visitor).toBeNull();
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

  it('limits the addresses of one IPv6 /64 as one caller', async () => {
    for (let host = 1; host <= 3; host += 1) {
      await ask(app, 'Stripe?', `2001:db8:1:2::${String(host)}`).expect(200);
    }
    await ask(app, 'Stripe?', '2001:db8:1:2:aaaa:bbbb:cccc:dddd').expect(429);
    await ask(app, 'Stripe?', '2001:db8:1:3::1').expect(200);
  });

  it('does not let a refused client use up the budget the whole site shares', async () => {
    for (let i = 0; i < 3; i += 1) {
      await ask(app, 'Stripe?', '198.51.100.4').expect(200);
    }
    for (let i = 0; i < 3; i += 1) {
      await ask(app, 'Stripe?', '198.51.100.4').expect(429);
    }
    const everyone = await prisma.rateLimit.findFirst({ where: { key: 'ask:day:everyone' } });
    expect(everyone?.count).toBe(3);
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
    const base = { engine: 'keyword', sentences: [], withheld: [], refused: true };
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

describe('POST /ask when the answer runs past midnight UTC', () => {
  let app: NestExpressApplication;
  let clock: FixedClock;
  let prisma: PrismaService;
  const slow: AnswerEngine = {
    name: 'slow',
    async *answer() {
      clock.current = new Date('2026-10-03T00:00:05Z');
      yield { text: 'It asks fewer questions.', sourceIds: ['tuner/fewer-questions'] };
    },
  };

  beforeAll(async () => {
    ({ app, clock, prisma } = await startApp({}, slow));
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await prisma.$executeRaw`TRUNCATE "RateLimit", "AskLog", "Visit" CASCADE`;
  });

  it('keeps the time and the visit of the moment the question arrived', async () => {
    clock.current = new Date('2026-10-02T23:59:58Z');
    await sendEvent(app, { type: 'view', id: randomUUID(), path: '/' }).expect(204);
    await ask(app, 'How does Tuner pick its questions?').expect(200);

    const [row] = await loggedRows(prisma, 'How does Tuner pick its questions?');
    const [visit] = await prisma.visit.findMany();
    expect(row?.createdAt).toEqual(new Date('2026-10-02T23:59:58Z'));
    expect(row?.visitor).toMatch(/^[0-9a-f]{32}$/);
    expect(row?.visitor).toBe(visit?.visitor);
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

describe('POST /ask when the engine fails', () => {
  const failing: AnswerEngine = {
    name: 'failing',
    async *answer(question) {
      if (question.includes('Tuner')) {
        yield { text: 'It asks fewer questions.', sourceIds: ['tuner/fewer-questions'] };
      }
      throw new Error('the model went away');
    },
  };
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await startApp({}, failing));
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await prisma.$executeRaw`TRUNCATE "RateLimit", "AskLog"`;
  });

  async function expectNoRow(question: string) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await prisma.askLog.count({ where: { question } })).toBe(0);
  }

  it('ends the answer without a done event when the engine fails after the first sentence, and logs nothing', async () => {
    const response = await ask(app, 'How does Tuner work?').expect(200);
    expect(parseEvents(response.text).map((event) => event.event)).toEqual(['meta', 'sentence']);
    await expectNoRow('How does Tuner work?');
  });

  it('ends the answer without a done event when the engine fails before saying anything, and logs nothing', async () => {
    const response = await ask(app, 'What is your favourite colour?').expect(200);
    expect(parseEvents(response.text).map((event) => event.event)).toEqual(['meta']);
    await expectNoRow('What is your favourite colour?');
  });
});
