import { describe, expect, it } from 'vitest';
import type { Report, Totals } from '../analytics/report/report.js';
import { reportText } from './report-text.js';

const someVisits = (visits: number): Totals => ({
  visits,
  pageViews: visits * 3,
  medianVisitSeconds: 40,
  phoneVisits: 1,
  quickExits: 0,
});

function aReport(overrides: Partial<Report> = {}): Report {
  return {
    period: {
      from: new Date('2026-10-23T12:00:00Z'),
      to: new Date('2026-10-30T12:00:00Z'),
      days: 7,
    },
    overview: { current: someVisits(12), previous: someVisits(8) },
    weeks: [],
    sources: [],
    otherSites: [],
    entries: [],
    journeys: [],
    pages: [],
    reading: [],
    links: { cvViews: 0, cvPdf: [], outbound: [] },
    ask: { questions: 0, refused: 0, days: [] },
    audience: { devices: [], browsers: [], countries: [] },
    quality: { vitals: [], errors: [], notFound: [] },
    filter: [],
    ...overrides,
  };
}

describe('reportText', () => {
  it('heads the report with the period in Baku time', () => {
    expect(reportText(aReport(), { all: false })).toMatch(
      /^Visits in the last 7 days, 2026-10-23 16:00 to 2026-10-30 16:00 Baku time\n/,
    );
  });

  it('puts the period and the one before side by side', () => {
    const text = reportText(aReport(), { all: false });
    expect(text).toMatch(/^Overview +last 7 days +7 days before$/m);
    expect(text).toMatch(/^visits +12 +8$/m);
    expect(text).toMatch(/^on a phone +8% +13%$/m);
  });

  it('says when the period before is no longer kept', () => {
    const text = reportText(
      aReport({
        period: {
          from: new Date('2026-10-14T12:00:00Z'),
          to: new Date('2026-10-30T12:00:00Z'),
          days: 16,
        },
        overview: { current: someVisits(12), previous: null },
      }),
      { all: false },
    );
    expect(text).toMatch(/^Overview +last 16 days$/m);
    expect(text).toContain('The 16 days before are older than the 30 days kept.');
  });

  it('cuts a list at ten rows unless asked for all of them', () => {
    const entries = Array.from({ length: 12 }, (_, index) => ({
      path: `/page-${String(index + 1)}`,
      visits: 12 - index,
    }));
    const short = reportText(aReport({ entries }), { all: false });
    expect(short).toMatch(/^\/page-10 +3$/m);
    expect(short).not.toContain('/page-11');
    expect(short).toContain('and 2 more, --all shows them');
    const full = reportText(aReport({ entries }), { all: true });
    expect(full).toMatch(/^\/page-12 +1$/m);
    expect(full).not.toContain('more, --all');
  });

  it('says none for a list with nothing in it', () => {
    expect(reportText(aReport(), { all: false })).toContain('Sources: none');
  });

  it('shows the share of views that read each block', () => {
    const text = reportText(
      aReport({
        reading: [
          {
            path: '/projects/tuner',
            views: 4,
            medianSeconds: 90,
            medianScroll: 70,
            blocks: [
              { block: 'problem', readers: 3, medianSeconds: 6 },
              { block: 'proof', readers: 0, medianSeconds: null },
            ],
          },
        ],
      }),
      { all: false },
    );
    expect(text).toContain('Reading /projects/tuner: 4 views, median 90 s, scroll 70%');
    expect(text).toMatch(/^problem +75% +6$/m);
    expect(text).toMatch(/^proof +0% +-$/m);
  });

  it('shows each Web Vital with its rating and samples, and marks one over my own bar', () => {
    const text = reportText(
      aReport({
        quality: {
          vitals: [
            {
              path: '/',
              device: 'phone',
              lcp: { p75: 2100, samples: 4, rating: 'good', overMyBar: true },
              inp: null,
              cls: { p75: 0.02, samples: 4, rating: 'good', overMyBar: false },
            },
          ],
          errors: [],
          notFound: [],
        },
      }),
      { all: false },
    );
    expect(text).toMatch(/^\/ +phone +2\.1 s good\* \(4\) +- +0\.02 good \(4\)$/m);
    expect(text).toContain('* over my own bar: LCP 2.0 s, INP 200 ms, CLS 0.05');
  });

  it('prints the control characters a visitor sent as visible escapes, not as terminal commands', () => {
    const text = reportText(
      aReport({
        quality: {
          vitals: [],
          errors: [
            {
              message: '\u001b]52;c;aGk=\u0007\u001b[2J\nvisits  9999',
              source: '/_next/static/chunks/a.js',
              count: 1,
              paths: ['/'],
              browsers: ['chrome'],
            },
          ],
          notFound: [],
        },
      }),
      { all: false },
    );
    expect(text).toContain('\\u{1b}]52;c;aGk=\\u{7}\\u{1b}[2J\\u{a}visits  9999');
    expect(text).not.toMatch(/\p{Cc}(?<!\n)/u);
  });

  it('ends with the credit the IP database asks for', () => {
    expect(reportText(aReport(), { all: false })).toMatch(
      /Countries and networks: IP Geolocation by DB-IP, https:\/\/db-ip\.com\n$/,
    );
  });
});
