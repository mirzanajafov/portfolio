import type { ReportPart, ReportSection } from '@portfolio/content/report-sections';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReportView } from './report-view';

const line = (text: string, indent = false) => ({ kind: 'line' as const, text, indent });

const table = (...rows: string[][]) => ({ kind: 'table' as const, rows });

const titled = (
  id: string,
  label: string,
  opening: ReturnType<typeof line> | ReturnType<typeof table>,
  parts: ReportPart[] = [],
): ReportSection => ({ kind: 'titled', id, label, opening, parts });

const sections: ReportSection[] = [
  titled('devices', 'Devices', table(['Devices', 'visits'], ['desktop', '7'])),
  titled('ask', 'Ask', line('Ask: 5 questions, 0 refused'), [
    table(['UTC day', 'questions'], ['2026-11-06', '2']),
  ]),
  titled('cv-views', 'CV page views', line('CV page views: 6')),
  { kind: 'none', text: 'Script errors: none' },
];

describe('ReportView', () => {
  it("titles each section with its opening line, or with the first header of the table that opens it, under the section's own anchor", () => {
    render(<ReportView sections={sections} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Devices' })).toHaveAttribute(
      'id',
      'devices',
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Ask: 5 questions, 0 refused' }),
    ).toHaveAttribute('id', 'ask');
    expect(screen.getByRole('heading', { level: 2, name: 'CV page views: 6' })).toHaveAttribute(
      'id',
      'cv-views',
    );
  });

  it('shows an empty section as one muted line with no heading', () => {
    render(<ReportView sections={sections} />);

    expect(screen.getByText('Script errors: none')).toHaveClass('text-muted');
    expect(screen.queryByRole('heading', { name: /Script errors/ })).toBeNull();
  });

  it("puts each table in a focusable region named after the table, and keeps an opening table's first header for screen readers only", () => {
    render(<ReportView sections={sections} />);

    const devices = screen.getByRole('region', { name: 'Devices' });
    expect(devices).toHaveAttribute('tabindex', '0');
    const title = within(devices).getByRole('columnheader', { name: 'Devices' });
    expect(title.querySelector('.sr-only')).toHaveTextContent('Devices');
    const askDays = screen.getByRole('region', { name: 'Ask, UTC day' });
    const label = within(askDays).getByRole('columnheader', { name: 'UTC day' });
    expect(label.querySelector('.sr-only')).toBeNull();
  });

  it('lines up the figures of number cells, and leaves headers, first columns and values with words alone', () => {
    render(
      <ReportView
        sections={[
          titled(
            'sources',
            'Sources',
            table(['Sources', 'visits', 'share'], ['direct', '4', '100%']),
          ),
          titled('other-sites', 'Other sites', table(['Other sites', 'visits'], ['10.0.0.5', '2'])),
          titled(
            'web-vitals',
            'Web Vitals',
            table(
              ['Web Vitals, p75 (samples)', 'device', 'LCP'],
              ['/projects/matchium', 'desktop', '0.14 s good (4)'],
            ),
          ),
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
