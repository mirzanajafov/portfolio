import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReportView } from './report-view';

describe('ReportView', () => {
  it('lines up the figures of cells without words, and leaves headers and cells with words alone', () => {
    render(
      <ReportView
        sections={[
          [
            {
              kind: 'table',
              rows: [
                ['Web Vitals, p75 (samples)', 'visits', 'LCP'],
                ['2026-10-26*', '40', '0.14 s good (4)'],
              ],
            },
          ],
        ]}
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'visits' })).not.toHaveClass('tabular-nums');
    expect(screen.getByRole('cell', { name: '2026-10-26*' })).toHaveClass('tabular-nums');
    expect(screen.getByRole('cell', { name: '40' })).toHaveClass('tabular-nums');
    expect(screen.getByRole('cell', { name: '0.14 s good (4)' })).not.toHaveClass('tabular-nums');
  });
});
