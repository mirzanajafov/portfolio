import { aCaseStudy, aProject, contentOf } from '@portfolio/content/testing';
import { describe, expect, it } from 'vitest';
import { buildReport } from './build-report.js';
import type { ReportRows, ViewRow, VisitRow } from './rows.js';

const now = new Date('2026-10-30T12:00:00Z');
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);
const daysAgo = (days: number) => hoursAgo(days * 24);

const content = await contentOf({
  projects: [
    aProject({ slug: 'tuner', name: 'Tuner', caseStudy: aCaseStudy() }),
    aProject({ slug: 'courier', name: 'Courier', order: 2 }),
  ],
});

function aView(overrides: Partial<ViewRow> = {}): ViewRow {
  return {
    createdAt: hoursAgo(1),
    path: '/',
    notFound: false,
    referrerHost: null,
    activeSeconds: 30,
    maxScroll: 50,
    blocks: {},
    lcpMs: null,
    inpMs: null,
    cls: null,
    clicks: [],
    errors: [],
    ...overrides,
  };
}

function aVisit(
  views: ViewRow[] = [aView()],
  overrides: Partial<Omit<VisitRow, 'views'>> = {},
): VisitRow {
  return {
    startedAt: hoursAgo(1),
    device: 'desktop',
    browser: 'chrome',
    country: 'AZ',
    views,
    ...overrides,
  };
}

function reportOf(
  visits: VisitRow[],
  { days = 7, ...rows }: Partial<Omit<ReportRows, 'visits'>> & { days?: number } = {},
) {
  return buildReport({ visits, questions: [], dropped: [], ...rows }, content, now, days);
}

describe('buildReport', () => {
  it('compares the period with the one before only while the rows of that one are kept', () => {
    const visits = [
      aVisit([aView()], { startedAt: daysAgo(1) }),
      aVisit([aView()], { startedAt: daysAgo(10) }),
    ];
    expect(reportOf(visits, { days: 7 }).overview.current.visits).toBe(1);
    expect(reportOf(visits, { days: 15 }).overview.previous?.visits).toBe(0);
    expect(reportOf(visits, { days: 16 }).overview.previous).toBeNull();
  });

  it("adds up a visit's seconds over its pages and counts one short page as a quick exit", () => {
    const report = reportOf([
      aVisit([aView({ activeSeconds: 20 }), aView({ path: '/cv', activeSeconds: 40 })]),
      aVisit([aView({ activeSeconds: 9 })], { device: 'phone' }),
      aVisit([aView({ activeSeconds: 12 })]),
    ]);
    expect(report.overview.current).toEqual({
      visits: 3,
      pageViews: 4,
      medianVisitSeconds: 12,
      phoneVisits: 1,
      quickExits: 1,
    });
  });

  it('marks the weeks at either end of the kept days as partial', () => {
    const report = reportOf([aVisit([aView()], { startedAt: daysAgo(3) })]);
    expect(report.weeks.map(({ start, partial, visits }) => [start, partial, visits])).toEqual([
      ['2026-09-28', true, 0],
      ['2026-10-05', false, 0],
      ['2026-10-12', false, 0],
      ['2026-10-19', false, 0],
      ['2026-10-26', true, 1],
    ]);
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
        lcp: { p75: 2100, samples: 4, rating: 'good', overMyBar: true },
        inp: null,
        cls: { p75: 0.02, samples: 4, rating: 'good', overMyBar: false },
      },
    ]);
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

  it('adds up the dropped events per day from the first day of the period', () => {
    const report = reportOf([], {
      days: 2,
      dropped: [
        { day: new Date('2026-10-28'), reason: 'bot', count: 5 },
        { day: new Date('2026-10-29'), reason: 'bot', count: 3 },
        { day: new Date('2026-10-29'), reason: 'limited', count: 1 },
        { day: new Date('2026-10-27'), reason: 'bot', count: 9 },
      ],
    });
    expect(report.filter).toEqual([
      { day: '2026-10-28', bot: 5, limited: 0 },
      { day: '2026-10-29', bot: 3, limited: 1 },
    ]);
  });
});
