import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ScenePlayer } from './scene-player';

const play = vi.fn(async () => ({
  setPlaying: vi.fn(),
  setShown: vi.fn(),
  focus: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock('@/scenes/player', () => ({ play }));

describe('ScenePlayer', () => {
  it('describes the scene for screen readers and stays quiet when there is no WebGL', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const { container } = render(
      <ScenePlayer name="systems" description="A graph of my systems" />,
    );
    expect(screen.getByRole('img', { name: 'A graph of my systems' })).toBeInTheDocument();
    await waitFor(() =>
      expect(container.querySelector('.scene')).toHaveAttribute('data-state', 'unsupported'),
    );
    expect(play).not.toHaveBeenCalled();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('pauses every scene on the page from any one button, and stops drawing a hidden one', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext);
    const systems = <ScenePlayer key="systems" name="systems" description="A graph" />;
    const { rerender } = render(<>{systems}</>);
    await screen.findByRole('button', { name: 'Pause motion' });
    rerender(
      <>
        {systems}
        <ScenePlayer key="population" name="population" description="People" shown={false} />
      </>,
    );
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Pause motion' })).toHaveLength(2),
    );
    const [first, second] = await Promise.all(play.mock.results.map((result) => result.value));
    expect(first.setShown).toHaveBeenLastCalledWith(true);
    expect(second.setShown).toHaveBeenLastCalledWith(false);

    await userEvent.click(screen.getAllByRole('button', { name: 'Pause motion' })[0]!);
    expect(screen.getAllByRole('button', { name: 'Play motion' })).toHaveLength(2);
    expect(first.setPlaying).toHaveBeenLastCalledWith(false);
    expect(second.setPlaying).toHaveBeenLastCalledWith(false);
  });
});
