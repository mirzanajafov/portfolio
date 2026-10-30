import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AnalyticsReportService } from '../src/analytics/report/analytics-report.service.js';
import { RetentionService } from '../src/analytics/retention.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { fixtureContent } from './content.fixture.js';
import { sendEvent } from './send-event.js';
import { FixedClock, startApp } from './start-app.js';

const iphone =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const crawler = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

describe('the visitor report against a real database', () => {
  let app: NestExpressApplication;
  let clock: FixedClock;
  let prisma: PrismaService;
  let reports: AnalyticsReportService;

  const send = (event: object, sender?: { ip?: string; userAgent?: string }) =>
    sendEvent(app, event, sender).expect(204);

  const at = (time: string) => {
    clock.current = new Date(`2026-10-02T${time}Z`);
  };

  beforeAll(async () => {
    ({ app, clock, prisma } = await startApp());
    reports = new AnalyticsReportService(prisma, clock, fixtureContent);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE "RateLimit", "Visit", "PageView", "LinkClick", "ClientError", "DroppedEvents", "AskLog", "DailyVisits", "DailyPage", "DailySource", "DailyCountry", "DailyClick", "DailyApplication"`;
  });

  it('reports a scripted visit the way it happened, from events sent to the API', async () => {
    const home = randomUUID();
    const caseStudy = randomUUID();
    at('12:00:00');
    await send({ type: 'view', id: home, path: '/', referrer: 'www.google.com' });
    await send({ type: 'vital', view: home, name: 'LCP', value: 1800 });
    await send({
      type: 'read',
      view: home,
      seq: 1,
      activeSeconds: 40,
      maxScroll: 80,
      blocks: { tuner: 5, ask: 1 },
    });
    at('12:01:00');
    await send({ type: 'view', id: caseStudy, path: '/projects/tuner' });
    await send({
      type: 'read',
      view: caseStudy,
      seq: 1,
      activeSeconds: 60,
      maxScroll: 100,
      blocks: { problem: 3, 'decision-1': 2 },
    });
    await send({ type: 'click', view: caseStudy, href: 'https://github.com/someone/tuner' });
    await send({
      type: 'error',
      view: caseStudy,
      message: 'x is undefined',
      source: '/_next/static/chunks/a.js',
    });
    at('12:05:00');
    await send(
      {
        type: 'view',
        id: randomUUID(),
        path: '/old',
        notFound: true,
        referrer: 'news.ycombinator.com',
      },
      { ip: '198.51.100.4', userAgent: iphone },
    );
    await send({ type: 'view', id: randomUUID(), path: '/' }, { userAgent: crawler });
    await request(app.getHttpServer())
      .post('/ask')
      .set('X-Forwarded-For', '203.0.113.7')
      .send({ question: 'How does Tuner decide which questions to ask each user?' })
      .expect(200);
    await expect.poll(() => prisma.askLog.count()).toBe(1);
    at('12:10:00');

    const report = await reports.build(7);

    const none = {
      visits: 0,
      pageViews: 0,
      medianVisitSeconds: null,
      phoneVisits: 0,
      quickExits: 0,
    };
    expect(report.overview).toEqual({
      today: { visits: 2, pageViews: 3, medianVisitSeconds: 0, phoneVisits: 1, quickExits: 1 },
      current: none,
      previous: none,
    });
    expect(report.sources).toEqual([
      { source: 'google', visits: 1 },
      { source: 'other', visits: 1 },
    ]);
    expect(report.journeys).toContainEqual({ paths: ['/', '/projects/tuner'], visits: 1 });
    expect(report.reading.find(({ path }) => path === '/projects/tuner')?.blocks).toEqual([
      { block: 'problem', readers: 1, medianSeconds: 3 },
      { block: 'decision-1', readers: 1, medianSeconds: 2 },
      { block: 'decision-2', readers: 0, medianSeconds: null },
      { block: 'proof', readers: 0, medianSeconds: null },
      { block: 'next', readers: 0, medianSeconds: null },
    ]);
    expect(report.links.outbound).toEqual([{ label: 'Tuner repo', clicks: 1 }]);
    expect(report.quality.vitals).toEqual([
      {
        path: '/',
        device: 'desktop',
        lcp: { p75: 1800, samples: 1, rating: 'good', missesMyBar: false },
        inp: null,
        cls: null,
      },
    ]);
    expect(report.quality.errors).toEqual([
      {
        message: 'x is undefined',
        source: '/_next/static/chunks/a.js',
        count: 1,
        paths: ['/projects/tuner'],
        browsers: ['chrome'],
      },
    ]);
    expect(report.quality.notFound).toEqual([
      { path: '/old', views: 1, referrers: ['news.ycombinator.com'] },
    ]);
    expect(report.ask).toEqual({
      questions: 1,
      refused: 0,
      days: [{ day: '2026-10-02', questions: 1, refused: 0 }],
    });
    expect(report.filter).toEqual([{ day: '2026-10-02', bot: 1, limited: 0 }]);
  });

  it('gives a day the same totals before and after it is rolled up', async () => {
    const reading = randomUUID();
    at('12:00:00');
    await send({ type: 'view', id: reading, path: '/' });
    await send({
      type: 'read',
      view: reading,
      seq: 1,
      activeSeconds: 40,
      maxScroll: 60,
      blocks: {},
    });
    await send(
      { type: 'view', id: randomUUID(), path: '/cv' },
      { ip: '198.51.100.4', userAgent: iphone },
    );
    const weekOf = async () =>
      (await reports.build(7)).weeks.find(({ start }) => start === '2026-09-28');

    clock.current = new Date('2026-10-03T12:00:00Z');
    const raw = await weekOf();
    clock.current = new Date('2026-11-02T00:00:00Z');
    await app.get(RetentionService).cleanup();
    expect(await prisma.visit.count()).toBe(0);
    const rolled = await weekOf();

    const totals = (week: typeof raw) => ({
      visits: week?.visits,
      pageViews: week?.pageViews,
      medianVisitSeconds: week?.medianVisitSeconds,
      phoneVisits: week?.phoneVisits,
      quickExits: week?.quickExits,
    });
    expect(totals(raw)).toEqual({
      visits: 2,
      pageViews: 2,
      medianVisitSeconds: 0,
      phoneVisits: 1,
      quickExits: 1,
    });
    expect(totals(rolled)).toEqual(totals(raw));
  });

  it('counts a day that is due but not rolled up yet from its raw rows', async () => {
    at('12:00:00');
    await send({ type: 'view', id: randomUUID(), path: '/' });
    clock.current = new Date('2026-11-02T00:30:00Z');

    const report = await reports.build(7);

    expect(report.weeks.find(({ start }) => start === '2026-09-28')?.visits).toBe(1);
    expect(report.unrolledSince).toBeNull();
  });
});
