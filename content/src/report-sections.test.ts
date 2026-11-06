import { describe, expect, it } from 'vitest';
import { reportSections, type ReportSection } from './report-sections.ts';
import { aFullReport, aReport, aTally, anEntry, someApplications } from './testing.ts';

const idsOf = (sections: ReportSection[]) =>
  sections.flatMap((section) => (section.kind === 'titled' ? [section.id] : []));

describe('reportSections', () => {
  it('gives every section of a full report a title and an anchor of its own', () => {
    const sections = reportSections(aFullReport(), { all: false });

    expect(sections.every((section) => section.kind === 'titled')).toBe(true);
    expect(idsOf(sections)).toEqual([
      'period',
      'rollup-behind',
      'overview',
      'weeks',
      'sources',
      'other-sites',
      'entry-pages',
      'first-pages',
      'pages',
      'reading-home',
      'reading-projects-matchium',
      'cv-views',
      'cv-pdf',
      'link-clicks',
      'demos',
      'ask',
      'devices',
      'browsers',
      'countries',
      'data-centers',
      'web-vitals',
      'script-errors',
      'not-found',
      'applications',
      'filtered-out',
      'credits',
    ]);
  });

  it('keeps the same anchors when the lists in a report change', () => {
    const changed = aFullReport({
      period: { from: new Date('2026-10-01'), to: new Date('2026-10-31'), days: 30, visits: 80 },
      sources: [
        { source: 'linkedin', visits: 40 },
        { source: 'google', visits: 20 },
      ],
      dataCenters: {
        demoOnly: 0,
        list: [{ owner: 'Google LLC', visits: 5, pageViews: 5, medianSeconds: 0 }],
      },
      applications: someApplications({
        list: [anEntry(), anEntry({ code: 'k7mpx', company: 'Local' })],
        byChannel: [aTally('direct'), aTally('referral')],
        byVariant: [aTally('base')],
      }),
    });

    expect(idsOf(reportSections(changed, { all: true }))).toEqual(
      idsOf(reportSections(aFullReport(), { all: false })),
    );
  });

  it('leaves a section with nothing in it untitled, an Applications section included', () => {
    const quiet = reportSections(aReport(), { all: false });

    expect(quiet).toContainEqual({ kind: 'none', text: 'Applications: none registered' });
    expect(quiet).toContainEqual({ kind: 'none', text: 'Data centers: none' });
  });

  it('keeps the notes after an empty table under a titled none line', () => {
    const sections = reportSections(aReport({ dataCenters: { demoOnly: 2, list: [] } }), {
      all: false,
    });

    const dataCenters = sections.find(
      (section) => section.kind === 'titled' && section.id === 'data-centers',
    );
    expect(dataCenters).toMatchObject({
      opening: { text: '2 data-center visits saw only a demo' },
      parts: [{ text: 'Data-center visits are told apart only within the last 30 days.' }],
    });
  });
});
