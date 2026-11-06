import { describe, expect, it } from 'vitest';
import { reportSections } from './report-sections.ts';
import { aReport, someApplications } from './testing.ts';

const aReading = (path: string) => ({
  path,
  views: 3,
  medianSeconds: 12,
  medianScroll: 40,
  blocks: [{ block: 'problem', readers: 2, medianSeconds: 8 }],
});

describe('reportSections', () => {
  it('gives every titled section of a full report an anchor of its own that no data can change', () => {
    const report = aReport({
      rollupBehind: { from: '2026-09-28', to: '2026-09-29' },
      sources: [{ source: 'direct', visits: 3 }],
      reading: [aReading('/'), aReading('/projects/matchium'), aReading('/projects/poof')],
      ask: { since: null, questions: 1, refused: 0, inVisits: 0, visits: 0, days: [] },
      dataCenters: { demoOnly: 2, list: [] },
      filter: [{ day: '2026-10-30', bot: 1, limited: 0, origin: 0, own: 0 }],
      applications: someApplications({
        unknownCodes: [{ code: 'check1', visits: 1, firstSeen: new Date('2026-10-30T08:00:00Z') }],
      }),
    });

    const ids = reportSections(report, { all: false }).flatMap((section) =>
      section.kind === 'titled' ? [section.id] : [],
    );

    expect(ids).toEqual([
      'period',
      'rollup-behind',
      'overview',
      'weeks',
      'sources',
      'reading-home',
      'reading-projects-matchium',
      'reading-projects-poof',
      'cv-views',
      'ask',
      'data-centers',
      'applications',
      'filtered-out',
      'credits',
    ]);
  });

  it('leaves a section with nothing in it untitled, an Applications section included', () => {
    const quiet = reportSections(aReport(), { all: false });

    expect(quiet).toContainEqual({ kind: 'none', text: 'Applications: none registered' });
    expect(quiet).toContainEqual({ kind: 'none', text: 'Data centers: none' });
  });
});
