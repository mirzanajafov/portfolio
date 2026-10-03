import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SystemsTour, type TourStop } from './systems-tour';

vi.mock('@/components/scene-player', () => ({
  ScenePlayer: ({ focus }: { focus?: string | null }) => (
    <div data-testid="scene" data-focus={focus ?? 'overview'} />
  ),
}));

const stops: TourStop[] = [
  {
    id: 'matchium',
    name: 'Matchium',
    hook: 'Matches that show their work',
    fact: { text: 'Half the questions.', kind: 'measured' },
    stack: ['Python'],
    live: 'https://matchium.example',
    code: 'https://github.com/x/matchium',
    caseStudy: '/projects/matchium',
  },
  {
    id: 'tm-post',
    name: 'TM Post',
    hook: 'Keeps working offline',
    fact: { text: 'Flushes every 150 ms.', kind: 'parameter' },
    stack: ['Electron'],
    live: 'https://tmpost.example',
    privateSource: true,
  },
];

describe('SystemsTour', () => {
  it('lists every project as plain HTML, so the tour reads without the scene', () => {
    render(
      <SystemsTour
        intro={{ title: 'Things I built', body: 'Two apps.' }}
        stops={stops}
        apps={[]}
      />,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Things I built' })).toBeInTheDocument();
    const matchium = screen.getByRole('article', { name: 'Matchium' });
    expect(within(matchium).getByRole('link', { name: 'Case study' })).toHaveAttribute(
      'href',
      '/projects/matchium',
    );
    expect(within(matchium).getByRole('link', { name: 'Code' })).toBeInTheDocument();
    const tmPost = screen.getByRole('article', { name: 'TM Post' });
    expect(within(tmPost).queryByRole('link', { name: 'Code' })).toBeNull();
    expect(within(tmPost).getByText('Source available on request')).toBeInTheDocument();
    expect(within(tmPost).getByText('design parameter')).toBeInTheDocument();
  });

  it('starts on the overview before anything is scrolled into view', () => {
    render(<SystemsTour intro={{ title: 'Things I built', body: '' }} stops={stops} apps={[]} />);
    expect(screen.getByTestId('scene')).toHaveAttribute('data-focus', 'overview');
  });
});
