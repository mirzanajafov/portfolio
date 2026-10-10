import { act, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SystemsTour, type TourStop } from './systems-tour';

vi.mock('@/components/scene-player', () => ({
  ScenePlayer: ({
    name,
    focus,
    shown = true,
  }: {
    name: string;
    focus?: string | null;
    shown?: boolean;
  }) => <div data-testid={`scene-${name}`} data-focus={focus ?? 'overview'} data-shown={shown} />,
}));

type Watcher = { callback: IntersectionObserverCallback; targets: Element[] };
const watchers: Watcher[] = [];

class FakeObserver {
  private watcher: Watcher;
  constructor(callback: IntersectionObserverCallback) {
    this.watcher = { callback, targets: [] };
    watchers.push(this.watcher);
  }
  observe(target: Element) {
    this.watcher.targets.push(target);
  }
  disconnect() {
    this.watcher.targets = [];
  }
}

function arriveAt(id: string) {
  act(() => {
    for (const { callback, targets } of watchers) {
      const target = targets.find((element) => (element as HTMLElement).dataset.stop === id);
      if (target) {
        callback(
          [{ target, isIntersecting: true } as unknown as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
      }
    }
  });
}

afterEach(() => {
  watchers.length = 0;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

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
    demo: { scene: 'population', caption: 'Each point is a simulated person.' },
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
    expect(screen.getByTestId('scene-systems')).toHaveAttribute('data-focus', 'overview');
  });

  it("hands the stage to the project's own scene once the camera has flown there", () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.useFakeTimers();
    render(<SystemsTour intro={{ title: 'Things I built', body: '' }} stops={stops} apps={[]} />);
    expect(screen.queryByTestId('scene-population')).toBeNull();

    arriveAt('matchium');
    const systems = screen.getByTestId('scene-systems');
    const population = screen.getByTestId('scene-population');
    expect(systems).toHaveAttribute('data-focus', 'matchium');
    expect(population).toHaveAttribute('data-shown', 'true');
    expect(systems).toHaveAttribute('data-shown', 'true');
    act(() => vi.advanceTimersByTime(900));
    expect(systems).toHaveAttribute('data-shown', 'false');
    expect(screen.getByText('Each point is a simulated person.')).toBeVisible();

    arriveAt('tm-post');
    expect(systems).toHaveAttribute('data-shown', 'true');
    expect(systems).toHaveAttribute('data-focus', 'tm-post');
    expect(population).toHaveAttribute('data-shown', 'false');
    expect(population.parentElement).toHaveAttribute('aria-hidden', 'true');
  });
});
