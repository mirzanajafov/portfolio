import { describe, expect, it } from 'vitest';
import type { GuessedVisit, Report, VisitStory } from '@portfolio/content/report';
import { aReport, noOutcomes, someVisits } from '@portfolio/content/testing';
import { reportText } from './report-text.js';

const aStory = (overrides: Partial<VisitStory> = {}): VisitStory => ({
  at: new Date('2026-10-30T12:00:00Z'),
  from: null,
  pages: [{ path: '/', seconds: 30, read: [] }],
  clicks: [],
  interacted: true,
  ...overrides,
});

const anEntry = (
  overrides: Partial<Report['applications']['list'][number]> = {},
): Report['applications']['list'][number] => ({
  code: 'memh',
  company: 'Xsolla',
  role: 'Backend Engineer',
  appliedOn: '2026-10-29',
  visits: [],
  days: [],
  guesses: [],
  ...overrides,
});

describe('reportText', () => {
  it('heads the report with the UTC days of the period and the time in Baku', () => {
    expect(reportText(aReport(), { all: false })).toMatch(
      /^Visits in the last 7 full days and today: 2026-10-23 to 2026-10-30 UTC, today until 2026-10-30 16:00 Baku time\n/,
    );
  });

  it('puts today, the full days and the days before them side by side', () => {
    const text = reportText(aReport(), { all: false });
    expect(text).toMatch(/^Overview +today so far +last 7 days +7 days before$/m);
    expect(text).toMatch(/^visits +2 +12 +8$/m);
    expect(text).toMatch(/^on a phone +50% +8% +13%$/m);
  });

  it('says when the period before was never collected', () => {
    const text = reportText(
      aReport({
        period: {
          from: new Date('2026-10-15T00:00:00Z'),
          to: new Date('2026-10-30T12:00:00Z'),
          days: 16,
          visits: 14,
        },
        overview: { today: someVisits(2), current: someVisits(12), previous: null },
      }),
      { all: false },
    );
    expect(text).toMatch(/^Overview +today so far +last 16 days$/m);
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
    const text = reportText(aReport({ ask: { since: null, questions: 30, refused: 0, days } }), {
      all: false,
    });
    expect(text).toMatch(/^2026-10-30 +1 +0$/m);
    expect(text).not.toContain('more, --all');
  });

  it('prints every section in order, and says so when one has nothing in it', () => {
    const text = reportText(aReport(), { all: false });
    const headings = [
      'Visits in the last 7 full days and today',
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
      'Applications: none registered',
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

  it('warns when the daily rollup is behind', () => {
    expect(
      reportText(aReport({ rollupBehind: { from: '2026-09-27', to: '2026-09-29' } }), {
        all: false,
      }),
    ).toContain(
      'The daily rollup is behind: the visits of 2026-09-27 to 2026-09-29 should have been rolled up and deleted.',
    );
    expect(reportText(aReport(), { all: false })).not.toContain('rollup is behind');
  });

  it('says from when the questions are counted when the log does not reach back to the period', () => {
    const text = reportText(
      aReport({
        ask: { since: new Date('2026-09-30T12:00:00Z'), questions: 1, refused: 0, days: [] },
      }),
      { all: false },
    );
    expect(text).toContain(
      'Ask: 1 question, 0 refused, since 2026-09-30 16:00 Baku time, as far back as the log keeps them',
    );
  });

  it("tells an application's coded visits, rolled up days, guesses and how well the guesses do", () => {
    const text = reportText(
      aReport({
        applications: {
          list: [
            anEntry({
              visits: [
                aStory({
                  at: new Date('2026-10-30T10:00:00Z'),
                  from: 'www.linkedin.com',
                  pages: [
                    { path: '/', seconds: 40, read: ['tuner'] },
                    { path: '/cv', seconds: 8, read: [] },
                  ],
                  clicks: ['CV PDF'],
                }),
                aStory({
                  at: new Date('2026-10-30T11:00:00Z'),
                  pages: [{ path: '/', seconds: 0, read: [] }],
                  interacted: false,
                }),
              ],
              days: [{ day: '2026-09-12', visits: 2, views: 5 }],
              guesses: [
                {
                  ...aStory(),
                  confidence: 'medium',
                  candidates: [
                    { company: 'Xsolla', role: 'Backend Engineer' },
                    { company: 'Local', role: 'Developer' },
                  ],
                  signals: [
                    { kind: 'city', city: 'Baku' },
                    { kind: 'country', country: 'AZ' },
                  ],
                  daysAfter: 1,
                },
              ],
            }),
          ],
          score: {
            visits: 3,
            unplaced: 1,
            levels: {
              high: { right: 1, wrong: 0, tied: 0 },
              medium: { right: 0, wrong: 1, tied: 0 },
              low: noOutcomes().low,
            },
          },
          unknownCodes: [
            { code: 'check1', visits: 2, firstSeen: new Date('2026-10-30T08:00:00Z') },
          ],
        },
      }),
      { all: false },
    );
    expect(text).toContain(
      [
        'Applications, every visit kept rather than only the period, times in Baku',
        'Xsolla, Backend Engineer, applied 2026-10-29, code memh',
        '  2026-10-30 14:00, from www.linkedin.com: / 40 s (read tuner) > /cv 8 s, clicked CV PDF',
        '  2026-10-30 15:00: / 0 s, no interaction',
        '  UTC day 2026-09-12, rolled up: 2 visits, 5 page views',
        '  possibly Xsolla or Local, medium (Baku, AZ, 1 day after applying): 2026-10-30 16:00: / 30 s',
        'Guesses checked on 3 coded visits: high 1 right, 0 wrong, 0 tied, medium 0 right, 1 wrong, 0 tied, low 0 right, 0 wrong, 0 tied, 1 not placed',
        'Unknown codes, first seen in Baku time',
        '  check1: 2 visits, first 2026-10-30 12:00',
      ].join('\n'),
    );
  });

  it('names at most three candidates of a guess, and each of them once', () => {
    const company = (name: string, role = 'Developer') => ({ company: name, role });
    const text = reportText(
      aReport({
        applications: {
          list: [
            anEntry({
              guesses: [
                {
                  ...aStory(),
                  confidence: 'medium',
                  candidates: [
                    company('Xsolla'),
                    company('Wolt'),
                    company('Kapital'),
                    company('Pasha'),
                    company('Azercell'),
                  ],
                  signals: [{ kind: 'city', city: 'Baku' }],
                  daysAfter: 0,
                },
                {
                  ...aStory(),
                  confidence: 'medium',
                  candidates: [company('Xsolla'), company('Xsolla')],
                  signals: [{ kind: 'city', city: 'Baku' }],
                  daysAfter: 0,
                },
              ],
            }),
          ],
          score: { visits: 0, unplaced: 0, levels: noOutcomes() },
          unknownCodes: [],
        },
      }),
      { all: false },
    );
    expect(text).toContain('possibly Xsolla, Wolt, Kapital or 2 more, medium');
    expect(text).toContain('possibly Xsolla (Developer), medium');
  });

  it('names the role when a guess could be either of two applications to the same company', () => {
    const text = reportText(
      aReport({
        applications: {
          list: [
            anEntry({
              guesses: [
                {
                  ...aStory(),
                  confidence: 'medium',
                  candidates: [
                    { company: 'Xsolla', role: 'Backend Engineer' },
                    { company: 'Xsolla', role: 'Platform Engineer' },
                  ],
                  signals: [{ kind: 'city', city: 'Baku' }],
                  daysAfter: 0,
                },
              ],
            }),
          ],
          score: { visits: 0, unplaced: 0, levels: noOutcomes() },
          unknownCodes: [],
        },
      }),
      { all: false },
    );
    expect(text).toContain(
      'possibly Xsolla (Backend Engineer) or Xsolla (Platform Engineer), medium (Baku, 0 days after applying)',
    );
  });

  it('hides low guesses unless asked for all, and says so, and says when an application has no visits yet', () => {
    const lowGuess: GuessedVisit = {
      ...aStory(),
      confidence: 'low',
      candidates: [{ company: 'Xsolla', role: 'Backend Engineer' }],
      signals: [{ kind: 'country', country: 'AZ' }],
      daysAfter: 1,
    };
    const report = aReport({
      applications: {
        list: [anEntry({ guesses: [lowGuess] }), anEntry({ code: 'k7mpx', company: 'Wolt' })],
        score: { visits: 0, unplaced: 0, levels: noOutcomes() },
        unknownCodes: [],
      },
    });
    const short = reportText(report, { all: false });
    expect(short).toContain('  low guesses not shown: 1, --all shows them');
    expect(short).toContain(
      'Wolt, Backend Engineer, applied 2026-10-29, code k7mpx: no visits yet',
    );
    expect(reportText(report, { all: true })).toContain(
      '  possibly Xsolla, low (AZ, 1 day after applying): 2026-10-30 16:00: / 30 s',
    );
  });

  it('cuts the applications, their visits and the unknown codes at ten unless asked for all', () => {
    const twelve = Array.from({ length: 12 }, (_, index) => index);
    const report = aReport({
      applications: {
        list: twelve.map((index) =>
          anEntry({
            code: `code${String(index)}`,
            company: `Company ${String(index)}`,
            visits: index === 0 ? twelve.map(() => aStory()) : [],
          }),
        ),
        score: { visits: 0, unplaced: 0, levels: noOutcomes() },
        unknownCodes: twelve.map((index) => ({
          code: `check${String(index)}`,
          visits: 1,
          firstSeen: new Date('2026-10-30T08:00:00Z'),
        })),
      },
    });
    const short = reportText(report, { all: false });
    expect(short).not.toContain('Company 10');
    expect(short).toMatch(/^and 2 more, --all shows them$/m);
    expect(short).toMatch(/^ {2}and 2 more, --all shows them$/m);
    expect(short).not.toContain('check10');
    const full = reportText(report, { all: true });
    expect(full).toContain('Company 11');
    expect(full).toContain('check11');
  });

  it('ends with the credit the IP database asks for', () => {
    expect(reportText(aReport(), { all: false })).toMatch(
      /Countries and networks: IP Geolocation by DB-IP, https:\/\/db-ip\.com\n$/,
    );
  });
});
