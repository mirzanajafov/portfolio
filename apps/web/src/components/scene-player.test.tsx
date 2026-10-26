import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

beforeEach(() => {
  handles.length = 0;
  play.mockClear();
});

vi.mock('@/scenes/player', () => ({ play }));

describe('ScenePlayer', () => {
  it('describes the scene for screen readers and stays quiet when there is no WebGL', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
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

  it('starts the scene it is given now, and tells it what the old one was told', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext);
    const { rerender } = render(
      <ScenePlayer scene={{ name: 'floor' }} description="A floor" shown={false} />,
    );
    await screen.findByRole('button', { name: 'Pause motion' });
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
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext);
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

    await userEvent.click(screen.getAllByRole('button', { name: 'Pause motion' })[0]!);
    expect(screen.getAllByRole('button', { name: 'Play motion' })).toHaveLength(2);
    expect(first?.setPlaying).toHaveBeenLastCalledWith(false);
    expect(second?.setPlaying).toHaveBeenLastCalledWith(false);
  });
});
