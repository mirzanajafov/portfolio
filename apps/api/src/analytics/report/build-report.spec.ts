import { aCaseStudy, aProject, contentOf } from '@portfolio/content/testing';
import { describe, expect, it } from 'vitest';
import type { DayTotals } from '../day-totals.js';
import { utcDay } from '../days.js';
import { aView, aVisit, daysAgo, hoursAgo, now } from '../testing.js';
import type { VisitRow } from '../visits.js';
import { buildReport } from './build-report.js';
import type { ReportRows } from './rows.js';

const content = await contentOf({
  projects: [
    aProject({ slug: 'tuner', name: 'Tuner', caseStudy: aCaseStudy() }),
    aProject({ slug: 'courier', name: 'Courier', order: 2 }),
  ],
});

function reportOf(
  visits: VisitRow[],
  { days = 7, ...rows }: Partial<Omit<ReportRows, 'visits'>> & { days?: number } = {},
) {
  return buildReport(
    {
      rawFrom: utcDay(daysAgo(30)),
      visits,
      rolled: [],
      questions: [],
      dropped: [],
      applications: [],
      rolledApplications: [],
      ...rows,
    },
    content,
    now,
    days,
  );
}

function rolledDays(from: string, count: number): (DayTotals & { day: Date })[] {
  return Array.from({ length: count }, (_, index) => ({
    day: new Date(new Date(from).getTime() + index * 24 * 60 * 60 * 1000),
    visits: 1,
    pageViews: 2,
    phoneVisits: 0,
    quickExits: 0,
    visitSeconds: [10],
  }));
}

describe('buildReport', () => {
  it('compares the last full days with as many before them, and counts today on its own', () => {
    const report = reportOf(
      [
        aVisit([aView()], { startedAt: new Date('2026-10-30T01:00:00Z') }),
        aVisit([aView()], { startedAt: new Date('2026-10-23T00:30:00Z') }),
        aVisit([aView()], { startedAt: new Date('2026-10-22T23:30:00Z') }),
      ],
      { days: 7 },
    );
    expect(report.period.from).toEqual(new Date('2026-10-23T00:00:00Z'));
    expect(report.overview.today.visits).toBe(1);
    expect(report.overview.current.visits).toBe(1);
    expect(report.overview.previous?.visits).toBe(1);
  });

  it('reads the days before the period from their rolled totals once the raw ones are gone', () => {
    const report = reportOf([], { days: 30, rolled: rolledDays('2026-08-31', 30) });
    expect(report.overview.previous).toEqual({
      visits: 30,
      pageViews: 60,
      medianVisitSeconds: 10,
      phoneVisits: 0,
      quickExits: 0,
    });
  });

  it('counts a day the rollup has not reached yet from its raw rows', () => {
    const report = reportOf(
      [aVisit([aView({ activeSeconds: 30 })], { startedAt: new Date('2026-09-29T10:00:00Z') })],
      {
        days: 30,
        rawFrom: new Date('2026-09-29T00:00:00Z'),
        rolled: rolledDays('2026-08-31', 29),
      },
    );
    expect(report.overview.previous?.visits).toBe(30);
    expect(report.rollupBehind).toBeNull();
  });

  it('says which days the rollup should have reached once it has missed a whole one', () => {
    const report = reportOf([], { rawFrom: new Date('2026-09-28T00:00:00Z') });
    expect(report.rollupBehind).toEqual({ from: '2026-09-28', to: '2026-09-29' });
  });

  it('counts questions only as far back as the log keeps them', () => {
    const report = reportOf([], {
      days: 30,
      questions: [
        { createdAt: new Date('2026-09-30T08:00:00Z'), refused: false },
        { createdAt: new Date('2026-09-30T13:00:00Z'), refused: false },
      ],
    });
    expect(report.ask).toMatchObject({ since: new Date('2026-09-30T12:00:00Z'), questions: 1 });
    expect(reportOf([], { days: 7 }).ask.since).toBeNull();
  });

  it('has nothing to compare with when a day before the period was never collected', () => {
    const report = reportOf([], { days: 30, rolled: rolledDays('2026-09-01', 29) });
    expect(report.overview.previous).toBeNull();
  });

  it("adds up a visit's seconds over its pages and counts one short page as a quick exit", () => {
    const report = reportOf([
      aVisit([aView({ activeSeconds: 20 }), aView({ path: '/cv', activeSeconds: 40 })]),
      aVisit([aView({ activeSeconds: 9 })], { device: 'phone' }),
      aVisit([aView({ activeSeconds: 12 })]),
    ]);
    expect(report.overview.today).toEqual({
      visits: 3,
      pageViews: 4,
      medianVisitSeconds: 12,
      phoneVisits: 1,
      quickExits: 1,
    });
  });

  it('counts a visit that only reloaded its one page as a quick exit', () => {
    const report = reportOf([
      aVisit([
        aView({ createdAt: hoursAgo(2), activeSeconds: 3 }),
        aView({ createdAt: hoursAgo(1), activeSeconds: 3 }),
      ]),
    ]);
    expect(report.overview.today.quickExits).toBe(1);
  });

  it('starts the weeks at the first collected day and marks the incomplete ones as partial', () => {
    const report = reportOf([aVisit([aView()], { startedAt: daysAgo(3) })]);
    expect(report.weeks.map(({ start, partial, visits }) => [start, partial, visits])).toEqual([
      ['2026-09-28', true, 0],
      ['2026-10-05', false, 0],
      ['2026-10-12', false, 0],
      ['2026-10-19', false, 0],
      ['2026-10-26', true, 1],
    ]);
  });

  it('goes back 12 weeks at most, adding rolled days to raw ones', () => {
    const report = reportOf([aVisit([aView()], { startedAt: daysAgo(3) })], {
      rolled: rolledDays('2026-07-01', 91),
    });
    expect(report.weeks).toHaveLength(12);
    expect(report.weeks[0]).toMatchObject({ start: '2026-08-10', partial: false, visits: 7 });
    expect(report.weeks.at(-1)).toMatchObject({ start: '2026-10-26', partial: true, visits: 1 });
  });

  it('takes the source of a visit from its landing page only', () => {
    const report = reportOf([
      aVisit([
        aView({ createdAt: hoursAgo(2), referrerHost: 'www.google.com' }),
        aView({ createdAt: hoursAgo(1), referrerHost: 'github.com' }),
      ]),
      aVisit([aView({ referrerHost: 'news.ycombinator.com' })]),
      aVisit([aView()], { browser: 'linkedin' }),
    ]);
    expect(report.sources).toEqual([
      { source: 'google', visits: 1 },
      { source: 'linkedin', visits: 1 },
      { source: 'other', visits: 1 },
    ]);
    expect(report.otherSites).toEqual([{ host: 'news.ycombinator.com', visits: 1 }]);
  });

  it('follows the first three pages of a visit without repeating a reload', () => {
    const report = reportOf([
      aVisit([
        aView({ createdAt: hoursAgo(4), path: '/' }),
        aView({ createdAt: hoursAgo(3), path: '/' }),
        aView({ createdAt: hoursAgo(2), path: '/projects/tuner' }),
        aView({ createdAt: hoursAgo(1), path: '/cv' }),
      ]),
    ]);
    expect(report.entries).toEqual([{ path: '/', visits: 1 }]);
    expect(report.journeys).toEqual([{ paths: ['/', '/projects/tuner', '/cv'], visits: 1 }]);
  });

  it('counts the last page of a visit as its exit and keeps 404s out of the pages', () => {
    const report = reportOf([
      aVisit([
        aView({ createdAt: hoursAgo(3), path: '/', activeSeconds: 10, maxScroll: 40 }),
        aView({ createdAt: hoursAgo(2), path: '/nope', notFound: true }),
        aView({ createdAt: hoursAgo(1), path: '/', activeSeconds: 30, maxScroll: 80 }),
      ]),
      aVisit([aView({ path: '/cv', activeSeconds: 5, maxScroll: 100 })]),
    ]);
    expect(report.pages).toEqual([
      { path: '/', views: 2, visits: 1, medianSeconds: 10, medianScroll: 40, exits: 1 },
      { path: '/cv', views: 1, visits: 1, medianSeconds: 5, medianScroll: 100, exits: 1 },
    ]);
  });

  it('counts a block as read from 2 seconds on and lists the blocks in page order', () => {
    const report = reportOf([
      aVisit([
        aView({ path: '/projects/tuner', blocks: { problem: 4, 'decision-1': 2, proof: 1 } }),
      ]),
      aVisit([aView({ path: '/projects/tuner', blocks: { problem: 8 } })]),
    ]);
    expect(report.reading).toEqual([
      {
        path: '/projects/tuner',
        views: 2,
        medianSeconds: 30,
        medianScroll: 50,
        blocks: [
          { block: 'problem', readers: 2, medianSeconds: 4 },
          { block: 'decision-1', readers: 1, medianSeconds: 2 },
          { block: 'decision-2', readers: 0, medianSeconds: null },
          { block: 'proof', readers: 0, medianSeconds: null },
          { block: 'next', readers: 0, medianSeconds: null },
        ],
      },
    ]);
  });

  it('labels clicks from the content and counts CV downloads by the page they came from', () => {
    const report = reportOf([
      aVisit([
        aView({ path: '/cv', clicks: [{ href: '/cv.pdf' }] }),
        aView({
          path: '/projects/tuner',
          clicks: [{ href: 'https://github.com/someone/tuner' }, { href: '/cv.pdf' }],
        }),
        aView({ clicks: [{ href: 'https://github.com/someone/tuner' }] }),
      ]),
    ]);
    expect(report.links).toEqual({
      cvViews: 1,
      cvPdf: [
        { from: '/cv', clicks: 1 },
        { from: '/projects/tuner', clicks: 1 },
      ],
      outbound: [{ label: 'Tuner repo', clicks: 2 }],
    });
  });

  it('counts questions and refusals per day within the period', () => {
    const report = reportOf([], {
      questions: [
        { createdAt: new Date('2026-10-29T08:00:00Z'), refused: false },
        { createdAt: new Date('2026-10-29T09:00:00Z'), refused: true },
        { createdAt: new Date('2026-10-30T09:00:00Z'), refused: false },
        { createdAt: daysAgo(8), refused: false },
      ],
    });
    expect(report.ask).toEqual({
      since: null,
      questions: 3,
      refused: 1,
      days: [
        { day: '2026-10-29', questions: 2, refused: 1 },
        { day: '2026-10-30', questions: 1, refused: 0 },
      ],
    });
  });

  it('shares visits out by device, browser and country', () => {
    const report = reportOf([
      aVisit([aView()], { device: 'phone', browser: 'safari', country: 'NL' }),
      aVisit([aView()], { device: 'phone', browser: 'chrome', country: null }),
      aVisit(),
    ]);
    expect(report.audience).toEqual({
      devices: [
        { name: 'phone', visits: 2 },
        { name: 'desktop', visits: 1 },
      ],
      browsers: [
        { name: 'chrome', visits: 2 },
        { name: 'safari', visits: 1 },
      ],
      countries: [
        { name: 'AZ', visits: 1 },
        { name: 'NL', visits: 1 },
        { name: 'unknown', visits: 1 },
      ],
    });
  });

  it('rates the p75 of each Web Vital per page and device and marks it over my own bar', () => {
    const report = reportOf(
      [1000, 1800, 2100, 2600].map((lcpMs) => aVisit([aView({ lcpMs, cls: 0.02 })])),
    );
    expect(report.quality.vitals).toEqual([
      {
        path: '/',
        device: 'desktop',
        lcp: { p75: 2100, samples: 4, rating: 'good', missesMyBar: true },
        inp: null,
        cls: { p75: 0.02, samples: 4, rating: 'good', missesMyBar: false },
      },
    ]);
  });

  it('rates a p75 right at my own bar as missing it, even where Google rates it good', () => {
    const report = reportOf([aVisit([aView({ lcpMs: 2000, inpMs: 200, cls: 0.05 })])]);
    expect(report.quality.vitals[0]).toMatchObject({
      lcp: { p75: 2000, rating: 'good', missesMyBar: true },
      inp: { p75: 200, rating: 'good', missesMyBar: true },
      cls: { p75: 0.05, rating: 'good', missesMyBar: true },
    });
  });

  it('groups script errors by message and source with their pages and browsers', () => {
    const failure = { message: 'x is undefined', source: '/_next/static/chunks/a.js' };
    const report = reportOf([
      aVisit([aView({ errors: [failure] }), aView({ path: '/cv', errors: [failure] })]),
      aVisit([aView({ errors: [failure] })], { browser: 'safari' }),
    ]);
    expect(report.quality.errors).toEqual([
      { ...failure, count: 3, paths: ['/', '/cv'], browsers: ['chrome', 'safari'] },
    ]);
  });

  it('lists 404 paths with the sites that sent people there', () => {
    const report = reportOf([
      aVisit([aView({ path: '/old', notFound: true, referrerHost: 'news.ycombinator.com' })]),
      aVisit([aView({ path: '/old', notFound: true })]),
    ]);
    expect(report.quality.notFound).toEqual([
      { path: '/old', views: 2, referrers: ['news.ycombinator.com'] },
    ]);
  });

  it('adds up the dropped events of each UTC day in the period', () => {
    const report = reportOf([], {
      days: 2,
      dropped: [
        { day: new Date('2026-10-28'), reason: 'bot', count: 5 },
        { day: new Date('2026-10-29'), reason: 'bot', count: 3 },
        { day: new Date('2026-10-29'), reason: 'limited', count: 1 },
        { day: new Date('2026-10-30'), reason: 'bot', count: 2 },
        { day: new Date('2026-10-27'), reason: 'bot', count: 9 },
      ],
    });
    expect(report.filter).toEqual([
      { day: '2026-10-28', bot: 5, limited: 0 },
      { day: '2026-10-29', bot: 3, limited: 1 },
      { day: '2026-10-30', bot: 2, limited: 0 },
    ]);
  });
});
