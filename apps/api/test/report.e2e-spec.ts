import type { NestExpressApplication } from '@nestjs/platform-express';
import { reportSchema, type Report } from '@portfolio/content/report';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AnalyticsReportService } from '../src/analytics/report/analytics-report.service.js';
import { RetentionService } from '../src/analytics/retention.service.js';
import { reportText } from '../src/cli/report-text.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { anApplication } from './applications.js';
import { fixtureContent } from './content.fixture.js';
import { chrome, sendEvent, type Sender } from './send-event.js';
import { FixedClock, startApp } from './start-app.js';

const iphone =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const crawler = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const throughJson = (report: Report) => reportSchema.parse(JSON.parse(JSON.stringify(report)));

describe('the visitor report against a real database', () => {
  let app: NestExpressApplication;
  let clock: FixedClock;
  let prisma: PrismaService;
  let reports: AnalyticsReportService;

  const send = (event: object, sender?: Sender) => sendEvent(app, event, sender).expect(204);

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
    await prisma.$executeRaw`TRUNCATE "RateLimit", "Visit", "PageView", "LinkClick", "ClientError", "DroppedEvents", "AskLog", "DailyVisits", "DailyPage", "DailySource", "DailyCountry", "DailyClick", "DailyDemo", "DailyApplication", "Application" CASCADE`;
  });

  it('reports a scripted visit the way it happened, from events sent to the API, in a shape the site reads back whole', async () => {
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
      .set('User-Agent', chrome)
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
      openedDemo: 0,
      didDemoStep: 0,
    };
    expect(report.overview).toEqual({
      today: {
        visits: 2,
        pageViews: 3,
        medianVisitSeconds: 0,
        phoneVisits: 1,
        quickExits: 1,
        openedDemo: 0,
        didDemoStep: 0,
      },
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
      since: null,
      questions: 1,
      refused: 0,
      inVisits: 1,
      visits: 1,
      days: [{ day: '2026-10-02', questions: 1, refused: 0 }],
    });
    expect(report.filter).toEqual([{ day: '2026-10-02', bot: 1, limited: 0, origin: 0 }]);
    expect(throughJson(report)).toEqual(report);
  });

  it("keeps the site's numbers to the site's pages and counts a visit that saw only a demo apart, before and after a day is rolled up", async () => {
    const reading = randomUUID();
    const fromTheDemo = { headers: { Origin: 'https://tuner.najafov.dev' } };
    at('12:00:00');
    await send({ type: 'view', id: reading, path: '/' });
    await send({ type: 'view', id: randomUUID(), path: '/' }, fromTheDemo);
    await send(
      { type: 'view', id: randomUUID(), path: '/' },
      { ip: '198.51.100.9', ...fromTheDemo },
    );
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
    expect((await reports.build(7)).pages.find(({ path }) => path === '/')?.views).toBe(1);
    expect((await reports.build(7)).demos).toMatchObject({ opened: 1, demoOnly: 1 });
    clock.current = new Date('2026-11-02T00:00:00Z');
    await app.get(RetentionService).cleanup();
    expect(await prisma.visit.count()).toBe(0);
    expect(await prisma.pageView.count()).toBe(0);
    expect(await prisma.dailyDemo.findMany()).toEqual([
      expect.objectContaining({
        demo: 'tuner',
        fromSite: 1,
        demoOnly: [{ source: 'direct', visits: 1 }],
      }),
    ]);
    const rolled = await weekOf();

    const totals = (week: typeof raw) => ({
      visits: week?.visits,
      pageViews: week?.pageViews,
      medianVisitSeconds: week?.medianVisitSeconds,
      phoneVisits: week?.phoneVisits,
      quickExits: week?.quickExits,
      openedDemo: week?.openedDemo,
      didDemoStep: week?.didDemoStep,
    });
    expect(totals(raw)).toEqual({
      visits: 2,
      pageViews: 2,
      medianVisitSeconds: 0,
      phoneVisits: 1,
      quickExits: 1,
      openedDemo: 1,
      didDemoStep: 0,
    });
    expect(totals(rolled)).toEqual(totals(raw));
  });

  it('starts a visit at its first page, a demo page opened earlier that day included', async () => {
    at('00:30:00');
    await send(
      { type: 'view', id: randomUUID(), path: '/' },
      { headers: { Origin: 'https://tuner.najafov.dev' } },
    );
    at('21:00:00');
    await send({ type: 'view', id: randomUUID(), path: '/', ref: 'late1' });

    const { unknownCodes } = (await reports.build(7)).applications;
    expect(unknownCodes).toEqual([
      expect.objectContaining({ code: 'late1', firstSeen: new Date('2026-10-02T00:30:00Z') }),
    ]);
  });

  it('counts a day that is due but not rolled up yet from its raw rows', async () => {
    at('12:00:00');
    await send({ type: 'view', id: randomUUID(), path: '/' });
    clock.current = new Date('2026-11-02T00:30:00Z');

    const report = await reports.build(7);

    expect(report.weeks.find(({ start }) => start === '2026-09-28')?.visits).toBe(1);
    expect(report.rollupBehind).toBeNull();
  });

  it('puts a coded visit and a guessed one under the company the application went to, with when its link was first opened, and the site reads both back', async () => {
    await prisma.application.create({
      data: {
        ...anApplication({
          company: 'Xsolla',
          appliedOn: new Date('2026-10-01'),
          country: 'AZ',
          city: 'Baku',
        }),
        code: 'memh',
      },
    });
    at('12:00:00');
    await send({ type: 'view', id: randomUUID(), path: '/', ref: 'memh' });
    await send({ type: 'view', id: randomUUID(), path: '/cv' }, { userAgent: iphone });

    const report = await reports.build(7);

    const [xsolla] = report.applications.list;
    expect(xsolla?.firstSeenOn).toBe('2026-10-02');
    expect(xsolla?.visits.map(({ pages }) => pages.map(({ path }) => path))).toEqual([['/']]);
    expect(xsolla?.guesses).toMatchObject([
      {
        confidence: 'medium',
        candidates: [{ company: 'Xsolla', role: 'Backend Engineer' }],
        signals: [{ kind: 'city', city: 'Baku' }],
        daysAfter: 1,
      },
    ]);
    expect(reportText(report, { all: false })).toContain(
      'possibly Xsolla, medium (Baku, 1 day after applying)',
    );
    expect(throughJson(report)).toEqual(report);
  });

  it('gives each application its channel, variant, status and days to an answer, and tallies only those applied more than the guess window ago as old enough', async () => {
    await prisma.application.createMany({
      data: [
        {
          ...anApplication({ channel: 'referral', appliedOn: new Date('2026-09-01') }),
          code: 'kxqt',
          firstSeenOn: new Date('2026-09-02'),
          status: 'interview',
          answeredOn: new Date('2026-09-04'),
        },
        {
          ...anApplication({ channel: 'referral', appliedOn: new Date('2026-09-17') }),
          code: 'mpw7',
        },
        {
          ...anApplication({ cvVariant: 'payments', appliedOn: new Date('2026-09-18') }),
          code: 'k7mp',
          status: 'rejected',
          answeredOn: new Date('2026-09-18'),
        },
      ],
    });
    at('12:00:00');

    const report = await reports.build(7);

    expect(
      report.applications.list.map(({ code, channel, cvVariant, status, daysToAnswer }) => ({
        code,
        channel,
        cvVariant,
        status,
        daysToAnswer,
      })),
    ).toEqual([
      {
        code: 'k7mp',
        channel: 'direct',
        cvVariant: 'payments',
        status: 'rejected',
        daysToAnswer: 0,
      },
      { code: 'mpw7', channel: 'referral', cvVariant: 'base', status: 'sent', daysToAnswer: null },
      {
        code: 'kxqt',
        channel: 'referral',
        cvVariant: 'base',
        status: 'interview',
        daysToAnswer: 3,
      },
    ]);
    expect(report.applications.byChannel).toEqual([
      { name: 'referral', applications: 2, opened: 1, oldEnough: 2, answered: 1, medianDays: 3 },
      { name: 'direct', applications: 1, opened: 0, oldEnough: 0, answered: 0, medianDays: null },
    ]);
    expect(report.applications.byVariant.map(({ name, oldEnough }) => [name, oldEnough])).toEqual([
      ['base', 2],
      ['payments', 0],
    ]);
    expect(throughJson(report)).toEqual(report);
  });
});
