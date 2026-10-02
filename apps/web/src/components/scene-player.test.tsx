import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScenePlayer } from './scene-player';

const play = vi.fn(async () => ({ setPlaying: vi.fn(), focus: vi.fn(), dispose: vi.fn() }));

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
});
