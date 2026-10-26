import { describe, expect, it, vi } from 'vitest';
import { play } from './player';

describe('play', () => {
  it('stops a superseded scene before it touches the canvas', async () => {
    const abort = new AbortController();
    abort.abort();
    const canvas = document.createElement('canvas');
    const getContext = vi.spyOn(canvas, 'getContext');
    await expect(
      play({ name: 'floor' }, canvas, document.createElement('div'), {
        onReadout: () => undefined,
        signal: abort.signal,
        playing: true,
        shown: true,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(getContext).not.toHaveBeenCalled();
  });
});
