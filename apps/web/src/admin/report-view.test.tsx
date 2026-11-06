import type { ReportSection } from '@portfolio/content/report-sections';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { headingsOf, ReportView } from './report-view';

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
  [line('Demos, on the site'), line('Matchium 1', true)],
  [line('Demos, apart'), line('poof 1', true)],
];

describe('ReportView', () => {
  it('titles a section by its first line, or by the header of a table that opens it, as a heading with an anchor', () => {
    render(<ReportView sections={sections} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Devices' })).toHaveAttribute(
      'id',
      'devices',
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Ask: 5 questions, 0 refused' }),
    ).toHaveAttribute('id', 'ask');
    expect(screen.queryByRole('heading', { name: 'CV page views: 6' })).toBeNull();
    expect(screen.getByText('CV page views: 6')).toBeVisible();
  });

  it('jumps to every section with a heading by its title up to the first colon or comma, with unique anchors', () => {
    expect(headingsOf(sections).map(({ id, label }) => [id, label])).toEqual([
      ['devices', 'Devices'],
      ['ask', 'Ask'],
      ['reading', 'Reading /'],
      ['reading-cv', 'Reading /cv'],
      ['demos', 'Demos'],
      ['demos-2', 'Demos'],
    ]);
  });

  it('shows an empty section as one muted line with no heading', () => {
    render(<ReportView sections={sections} />);

    expect(screen.getByText('Script errors: none')).toHaveClass('text-muted');
    expect(screen.queryByRole('heading', { name: /Script errors/ })).toBeNull();
  });

  it("puts each table in a focusable region named by its first header, and keeps a titled table's first header for screen readers only", () => {
    render(<ReportView sections={sections} />);

    const devices = screen.getByRole('region', { name: 'Devices' });
    expect(devices).toHaveAttribute('tabindex', '0');
    const title = within(devices).getByRole('columnheader', { name: 'Devices' });
    expect(title.querySelector('.sr-only')).toHaveTextContent('Devices');
    const askDays = screen.getByRole('region', { name: 'UTC day' });
    const label = within(askDays).getByRole('columnheader', { name: 'UTC day' });
    expect(label.querySelector('.sr-only')).toBeNull();
  });

  it('lines up the figures of number cells, and leaves headers, first columns and values with words alone', () => {
    render(
      <ReportView
        sections={[
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
        ]}
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'share' })).not.toHaveClass('tabular-nums');
    expect(screen.getByRole('cell', { name: '10.0.0.5' })).not.toHaveClass('tabular-nums');
    expect(screen.getByRole('cell', { name: '4' })).toHaveClass('tabular-nums');
    expect(screen.getByRole('cell', { name: '100%' })).toHaveClass('tabular-nums');
    expect(screen.getByRole('cell', { name: '0.14 s good (4)' })).not.toHaveClass('tabular-nums');
  });
});
