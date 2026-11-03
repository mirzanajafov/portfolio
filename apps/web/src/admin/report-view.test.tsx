import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReportView } from './report-view';

describe('ReportView', () => {
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
