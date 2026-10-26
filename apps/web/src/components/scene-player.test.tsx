import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScenePlayer } from './scene-player';

function handle() {
  return { setPlaying: vi.fn(), setShown: vi.fn(), focus: vi.fn(), dispose: vi.fn() };
}

const handles: ReturnType<typeof handle>[] = [];

const play = vi.fn(async () => {
  const created = handle();
  handles.push(created);
  return created;
});

const webgl = { available: true };

beforeEach(() => {
  handles.length = 0;
  play.mockClear();
  webgl.available = true;
});

afterEach(() => {
  vi.restoreAllMocks();
});

vi.mock('@/scenes/player', () => ({ play }));
vi.mock('@/scenes/webgl', () => ({ webglAvailable: () => webgl.available }));

describe('ScenePlayer', () => {
  it('describes the scene for screen readers and stays quiet when there is no WebGL', async () => {
    webgl.available = false;
    const { container } = render(
      <ScenePlayer scene={{ name: 'systems', apps: [] }} description="A graph of my systems" />,
    );
    expect(screen.getByRole('img', { name: 'A graph of my systems' })).toBeInTheDocument();
    await waitFor(() =>
      expect(container.querySelector('.scene')).toHaveAttribute('data-state', 'unsupported'),
    );
    expect(play).not.toHaveBeenCalled();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('says which scene failed to start instead of passing it off as a browser without WebGL', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const broken = new RangeError('every series needs the same, non-zero number of samples');
    play.mockRejectedValueOnce(broken);
    const { container } = render(<ScenePlayer scene={{ name: 'storm' }} description="A storm" />);
    await waitFor(() =>
      expect(container.querySelector('.scene')).toHaveAttribute('data-state', 'failed'),
    );
    expect(error).toHaveBeenCalledWith('the storm scene could not start', broken);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('starts the scene it is given now, and tells it what the old one was told', async () => {
    const { rerender } = render(
      <ScenePlayer scene={{ name: 'floor' }} description="A floor" shown={false} />,
    );
    await screen.findByRole('button', { name: /motion$/ });
    rerender(<ScenePlayer scene={{ name: 'storm' }} description="A storm" shown={false} />);
    await waitFor(() => {
      expect(play).toHaveBeenLastCalledWith(
        { name: 'storm' },
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ shown: false }),
      );
    });
    const [floor, storm] = handles;
    expect(floor?.dispose).toHaveBeenCalled();
    await waitFor(() => {
      expect(storm?.setShown).toHaveBeenLastCalledWith(false);
    });
  });

  it('pauses every scene on the page from any one button, and stops drawing a hidden one', async () => {
    const systems = (
      <ScenePlayer key="systems" scene={{ name: 'systems', apps: [] }} description="A graph" />
    );
    const { rerender } = render(<>{systems}</>);
    await screen.findByRole('button', { name: 'Pause motion' });
    rerender(
      <>
        {systems}
        <ScenePlayer
          key="population"
          scene={{ name: 'population' }}
          description="People"
          shown={false}
        />
      </>,
    );
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Pause motion' })).toHaveLength(2),
    );
    const [first, second] = handles;
    await waitFor(() => {
      expect(first?.setShown).toHaveBeenLastCalledWith(true);
      expect(second?.setShown).toHaveBeenLastCalledWith(false);
    });

    const [pause] = screen.getAllByRole('button', { name: 'Pause motion' });
    assert(pause);
    await userEvent.click(pause);
    expect(screen.getAllByRole('button', { name: 'Play motion' })).toHaveLength(2);
    expect(first?.setPlaying).toHaveBeenLastCalledWith(false);
    expect(second?.setPlaying).toHaveBeenLastCalledWith(false);
  });
});
