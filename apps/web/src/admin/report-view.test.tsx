import type { ReportSection } from '@portfolio/content/report-sections';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReportView, titledSections } from './report-view';

const line = (text: string, indent = false) => ({ kind: 'line' as const, text, indent });

const sections: ReportSection[] = [
  [
    {
      kind: 'table',
      rows: [
        ['Devices', 'visits'],
        ['desktop', '7'],
      ],
    },
  ],
  [
    line('Ask: 5 questions, 0 refused'),
    {
      kind: 'table',
      rows: [
        ['UTC day', 'questions'],
        ['2026-11-06', '2'],
      ],
    },
  ],
  [line('CV page views: 6')],
  [{ kind: 'none', text: 'Script errors: none' }],
  [line('Reading /: 13 views'), line('carwash-ledger 4 s', true)],
  [line('Reading /cv: 2 views'), line('experience 3 s', true)],
];

const headingsOf = (report: ReportSection[], reserved: string[] = []) =>
  titledSections(report, reserved).flatMap(({ heading }) =>
    heading ? [[heading.id, heading.label]] : [],
  );

describe('ReportView', () => {
  it('titles every section by its first line, or by the header of a table that opens it, as a heading with an anchor', () => {
    render(<ReportView sections={titledSections(sections, [])} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Devices' })).toHaveAttribute(
      'id',
      'devices',
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Ask: 5 questions, 0 refused' }),
    ).toHaveAttribute('id', 'ask');
    expect(screen.getByRole('heading', { level: 2, name: 'CV page views: 6' })).toHaveAttribute(
      'id',
      'cv-page-views',
    );
  });

  it('labels each heading by its title up to the first colon or comma', () => {
    expect(headingsOf(sections)).toEqual([
      ['devices', 'Devices'],
      ['ask', 'Ask'],
      ['cv-page-views', 'CV page views'],
      ['reading', 'Reading /'],
      ['reading-cv', 'Reading /cv'],
    ]);
  });

  it('never gives two headings the same anchor, nor one the page already uses', () => {
    expect(
      headingsOf(
        [
          [line('Demos, on the site')],
          [line('Demos, apart')],
          [line('Demos 2')],
          [line('Application list')],
        ],
        ['application-list'],
      ),
    ).toEqual([
      ['demos', 'Demos'],
      ['demos-2', 'Demos'],
      ['demos-2-2', 'Demos 2'],
      ['application-list-2', 'Application list'],
    ]);
  });

  it('shows an empty section as one muted line with no heading', () => {
    render(<ReportView sections={titledSections(sections, [])} />);

    expect(screen.getByText('Script errors: none')).toHaveClass('text-muted');
    expect(screen.queryByRole('heading', { name: /Script errors/ })).toBeNull();
  });

  it("puts each table in a focusable region named by its section, and keeps a titled table's first header for screen readers only", () => {
    render(<ReportView sections={titledSections(sections, [])} />);

    const devices = screen.getByRole('region', { name: 'Devices' });
    expect(devices).toHaveAttribute('tabindex', '0');
    const title = within(devices).getByRole('columnheader', { name: 'Devices' });
    expect(title.querySelector('.sr-only')).toHaveTextContent('Devices');
    const askDays = screen.getByRole('region', { name: 'Ask' });
    const label = within(askDays).getByRole('columnheader', { name: 'UTC day' });
    expect(label.querySelector('.sr-only')).toBeNull();
  });

  it('lines up the figures of number cells, and leaves headers, first columns and values with words alone', () => {
    render(
      <ReportView
        sections={titledSections(
          [
            [
              {
                kind: 'table',
                rows: [
                  ['Sources', 'visits', 'share'],
                  ['direct', '4', '100%'],
                ],
              },
            ],
            [
              {
                kind: 'table',
                rows: [
                  ['Other sites', 'visits'],
                  ['10.0.0.5', '2'],
                ],
              },
            ],
            [
              {
                kind: 'table',
                rows: [
                  ['Web Vitals, p75 (samples)', 'device', 'LCP'],
                  ['/projects/matchium', 'desktop', '0.14 s good (4)'],
                ],
              },
            ],
          ],
          [],
        )}
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'share' })).not.toHaveClass('tabular-nums');
    expect(screen.getByRole('cell', { name: '10.0.0.5' })).not.toHaveClass('tabular-nums');
    expect(screen.getByRole('cell', { name: '4' })).toHaveClass('tabular-nums');
    expect(screen.getByRole('cell', { name: '100%' })).toHaveClass('tabular-nums');
    expect(screen.getByRole('cell', { name: '0.14 s good (4)' })).not.toHaveClass('tabular-nums');
  });
});
