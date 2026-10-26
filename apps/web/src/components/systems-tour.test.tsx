import { act, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SystemsTour, type TourStop } from './systems-tour';

vi.mock('@/components/scene-player', () => ({
  ScenePlayer: ({
    scene,
    focus,
    shown = true,
  }: {
    scene: { name: string };
    focus?: string | null;
    shown?: boolean;
  }) => (
    <div data-testid={`scene-${scene.name}`} data-focus={focus ?? 'overview'} data-shown={shown} />
  ),
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

function cross(attribute: 'stop' | 'scene', id: string, isIntersecting: boolean) {
  act(() => {
    for (const { callback, targets } of watchers) {
      const target = targets.find((element) => (element as HTMLElement).dataset[attribute] === id);
      if (target) {
        callback(
          [{ target, isIntersecting } as unknown as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
      }
    }
  });
}

const arriveAt = (id: string) => cross('stop', id, true);

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
    uses: [],
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
    uses: [{ slug: 'matchium', name: 'Matchium', for: 'its sync server' }],
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

  it('links a project to the stop of a project it uses, and says what for', () => {
    render(<SystemsTour intro={{ title: 'Things I built', body: '' }} stops={stops} apps={[]} />);
    const tmPost = screen.getByRole('article', { name: 'TM Post' });
    expect(within(tmPost).getByText(/^Uses/)).toHaveTextContent(
      'Uses Matchium for its sync server',
    );
    expect(within(tmPost).getByRole('link', { name: 'Matchium' })).toHaveAttribute(
      'href',
      '/#matchium',
    );
    const matchium = screen.getByRole('article', { name: 'Matchium' });
    expect(within(matchium).queryByText(/^Uses/)).toBeNull();
  });

  it('opens with an index that jumps to each stop of the tour', () => {
    render(<SystemsTour intro={{ title: 'Things I built', body: '' }} stops={stops} apps={[]} />);
    const index = screen.getByRole('navigation', { name: 'Projects' });
    const links = within(index).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#matchium', '#tm-post']);
    expect(links[1]).toHaveTextContent('TM PostKeeps working offline');
    for (const link of links) {
      const stop = document.getElementById(link.getAttribute('href')!.slice(1));
      expect(stop).toHaveAttribute('data-stop', stop?.id);
      expect(within(stop!).getByRole('article')).toBeInTheDocument();
    }
  });

  it('goes back to the stop above when scrolling up past the line between two stops', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    render(<SystemsTour intro={{ title: 'Things I built', body: '' }} stops={stops} apps={[]} />);
    arriveAt('matchium');
    arriveAt('tm-post');
    expect(screen.getByTestId('scene-systems')).toHaveAttribute('data-focus', 'tm-post');
    cross('stop', 'tm-post', false);
    expect(screen.getByTestId('scene-systems')).toHaveAttribute('data-focus', 'matchium');
  });

  it('starts on the overview before anything is scrolled into view', () => {
    render(<SystemsTour intro={{ title: 'Things I built', body: '' }} stops={stops} apps={[]} />);
    expect(screen.getByTestId('scene-systems')).toHaveAttribute('data-focus', 'overview');
  });

  it('fits the scene of a stop into the space its own card leaves free on a phone', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    let measure: ResizeObserverCallback = () => undefined;
    const observed: Element[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          measure = callback;
        }
        observe(target: Element) {
          observed.push(target);
        }
        disconnect() {}
      },
    );
    render(<SystemsTour intro={{ title: 'Things I built', body: '' }} stops={stops} apps={[]} />);
    expect(observed).toEqual([screen.getByRole('article', { name: 'Matchium' })]);
    arriveAt('matchium');
    const card = observed[0]!;
    card.getBoundingClientRect = () => ({ height: 401.4 }) as DOMRect;
    act(() => measure([{ target: card } as unknown as ResizeObserverEntry], {} as ResizeObserver));
    const layer = screen.getByTestId('scene-population').parentElement!;
    expect(layer.style.getPropertyValue('--card-height')).toBe('401px');
  });

  it("shows the map close-up for the first half of a stop and the project's own scene for the rest", () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.useFakeTimers();
    render(<SystemsTour intro={{ title: 'Things I built', body: '' }} stops={stops} apps={[]} />);
    expect(screen.queryByTestId('scene-population')).toBeNull();

    arriveAt('matchium');
    const systems = screen.getByTestId('scene-systems');
    const population = screen.getByTestId('scene-population');
    expect(systems).toHaveAttribute('data-focus', 'matchium');
    expect(systems).toHaveAttribute('data-shown', 'true');
    expect(population).toHaveAttribute('data-shown', 'false');
    act(() => vi.advanceTimersByTime(5000));
    expect(population).toHaveAttribute('data-shown', 'false');

    cross('scene', 'matchium', true);
    expect(population).toHaveAttribute('data-shown', 'true');
    expect(systems).toHaveAttribute('data-shown', 'true');
    act(() => vi.advanceTimersByTime(500));
    expect(systems).toHaveAttribute('data-shown', 'false');
    expect(screen.getByText('Each point is a simulated person.')).toBeVisible();

    cross('scene', 'matchium', false);
    expect(population).toHaveAttribute('data-shown', 'false');
    expect(systems).toHaveAttribute('data-shown', 'true');

    cross('scene', 'matchium', true);
    arriveAt('tm-post');
    expect(systems).toHaveAttribute('data-shown', 'true');
    expect(systems).toHaveAttribute('data-focus', 'tm-post');
    expect(population).toHaveAttribute('data-shown', 'false');
    expect(population.parentElement).toHaveAttribute('aria-hidden', 'true');
  });
});
