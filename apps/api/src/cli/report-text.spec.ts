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
      from: new Date('2026-10-24T00:00:00Z'),
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
  it('heads the report with the UTC days of the period and the time in Baku', () => {
    expect(reportText(aReport(), { all: false })).toMatch(
      /^Visits in the last 7 days: 2026-10-24 to 2026-10-30 UTC, today until 2026-10-30 16:00 Baku time\n/,
    );
  });

  it('puts the period and the one before side by side', () => {
    const text = reportText(aReport(), { all: false });
    expect(text).toMatch(/^Overview +last 7 days +7 days before$/m);
    expect(text).toMatch(/^visits +12 +8$/m);
    expect(text).toMatch(/^on a phone +8% +13%$/m);
  });

  it('says when the period before was never collected', () => {
    const text = reportText(
      aReport({
        period: {
          from: new Date('2026-10-15T00:00:00Z'),
          to: new Date('2026-10-30T12:00:00Z'),
          days: 16,
        },
        overview: { current: someVisits(12), previous: null },
      }),
      { all: false },
    );
    expect(text).toMatch(/^Overview +last 16 days$/m);
    expect(text).toContain(
      'Some of the 16 days before were never collected, so there is nothing to compare with.',
    );
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

  it('keeps every day of a day by day table, newest included', () => {
    const days = Array.from({ length: 30 }, (_, index) => ({
      day: `2026-10-${String(index + 1).padStart(2, '0')}`,
      questions: 1,
      refused: 0,
    }));
    const text = reportText(aReport({ ask: { questions: 30, refused: 0, days } }), {
      all: false,
    });
    expect(text).toMatch(/^2026-10-30 +1 +0$/m);
    expect(text).not.toContain('more, --all');
  });

  it('prints every section in order, and says so when one has nothing in it', () => {
    const text = reportText(aReport(), { all: false });
    const headings = [
      'Visits in the last 7 days',
      'Overview',
      'Weeks from Monday, UTC',
      'Sources: none',
      'Other sites: none',
      'Entry pages: none',
      'First pages of a visit: none',
      'Pages: none',
      'Reading: no views of the home page or a case study',
      'CV page views: 0',
      'CV PDF clicks from: none',
      'Link clicks: none',
      'Ask: 0 questions, 0 refused',
      'Devices: none',
      'Browsers: none',
      'Countries: none',
      'Web Vitals, p75 (samples): none',
      'Script errors: none',
      '404s: none',
      'Filtered out: none',
      'Countries and networks: IP Geolocation by DB-IP',
    ];
    const positions = headings.map((heading) => text.indexOf(heading));
    expect(positions).not.toContain(-1);
    expect(positions).toEqual(positions.toSorted((a, b) => a - b));
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
    expect(text).toMatch(/^block +read 2 s or more +median s$/m);
    expect(text).toMatch(/^problem +75% +6$/m);
    expect(text).toMatch(/^proof +0% +-$/m);
  });

  it('shows each Web Vital with its rating and samples, and marks one that misses my own bar', () => {
    const text = reportText(
      aReport({
        quality: {
          vitals: [
            {
              path: '/',
              device: 'phone',
              lcp: { p75: 2100, samples: 4, rating: 'good', missesMyBar: true },
              inp: null,
              cls: { p75: 0.02, samples: 4, rating: 'good', missesMyBar: false },
            },
          ],
          errors: [],
          notFound: [],
        },
      }),
      { all: false },
    );
    expect(text).toMatch(/^\/ +phone +2\.10 s good\* \(4\) +- +0\.020 good \(4\)$/m);
    expect(text).toContain(
      '* misses my own bar: LCP under 2.00 s, INP under 200 ms, CLS under 0.050',
    );
  });

  it('leaves out the note about my own bar when no vital on screen misses it', () => {
    const vitals: Report['quality']['vitals'] = Array.from({ length: 11 }, (_, index) => ({
      path: `/page-${String(index + 1)}`,
      device: 'desktop',
      lcp: { p75: 900, samples: 11 - index, rating: 'good', missesMyBar: index === 10 },
      inp: null,
      cls: null,
    }));
    const report = aReport({ quality: { vitals, errors: [], notFound: [] } });
    expect(reportText(report, { all: false })).not.toContain('misses my own bar');
    expect(reportText(report, { all: true })).toContain('misses my own bar');
  });

  it('leaves out the note about my own bar when no vital misses it', () => {
    const text = reportText(
      aReport({
        quality: {
          vitals: [
            {
              path: '/',
              device: 'desktop',
              lcp: { p75: 900, samples: 2, rating: 'good', missesMyBar: false },
              inp: null,
              cls: null,
            },
          ],
          errors: [],
          notFound: [],
        },
      }),
      { all: false },
    );
    expect(text).not.toContain('misses my own bar');
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
